import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import { newClientEventId } from '../lib/offlineQueue'
import type {
  ScanCheckResult,
  Transaction,
  TxnSource,
  TxnType,
  Unit,
} from '../lib/types'

function unitsCol() {
  return collection(getDb(), 'units')
}

function txnsCol() {
  return collection(getDb(), 'transactions')
}

export async function getUnit(chassisNo: string): Promise<Unit | null> {
  const snap = await getDoc(doc(getDb(), 'units', chassisNo))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    chassisNo,
    yardId: (data.yardId as string | null) ?? null,
    updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
    lastTxnId: (data.lastTxnId as string | null) ?? null,
  }
}

export async function listUnits(): Promise<Unit[]> {
  const snap = await getDocs(unitsCol())
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      chassisNo: d.id,
      yardId: (data.yardId as string | null) ?? null,
      updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
      lastTxnId: (data.lastTxnId as string | null) ?? null,
    }
  })
}

export function subscribeUnits(cb: (units: Unit[]) => void): Unsubscribe {
  return onSnapshot(unitsCol(), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data()
        return {
          chassisNo: d.id,
          yardId: (data.yardId as string | null) ?? null,
          updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
          lastTxnId: (data.lastTxnId as string | null) ?? null,
        }
      }),
    )
  })
}

export async function listUnitsInYard(yardId: string): Promise<Unit[]> {
  const snap = await getDocs(query(unitsCol(), where('yardId', '==', yardId)))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      chassisNo: d.id,
      yardId: (data.yardId as string | null) ?? null,
      updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
      lastTxnId: (data.lastTxnId as string | null) ?? null,
    }
  })
}

export async function checkScan(
  chassisNo: string,
  yardId: string,
  type: 'IN' | 'OUT',
): Promise<ScanCheckResult> {
  const unit = await getUnit(chassisNo)
  if (type === 'IN') {
    if (unit?.yardId === yardId) {
      return {
        ok: false,
        code: 'duplicate_in',
        message: 'Already IN this yard',
        currentYardId: yardId,
      }
    }
    if (unit?.yardId && unit.yardId !== yardId) {
      return {
        ok: false,
        code: 'transfer',
        message: 'Currently at another yard — confirm transfer?',
        currentYardId: unit.yardId,
      }
    }
    return { ok: true }
  }
  // OUT
  if (!unit?.yardId || unit.yardId !== yardId) {
    return {
      ok: false,
      code: 'out_without_in',
      message: 'Not recorded IN this yard — confirm OUT anyway?',
      currentYardId: unit?.yardId ?? null,
    }
  }
  return { ok: true }
}

export interface ApplyScanInput {
  chassisNo: string
  yardId: string
  type: 'IN' | 'OUT'
  staffNo: string
  source?: TxnSource
  clientTime?: number
  clientEventId?: string
  confirmTransfer?: boolean
  confirmOutWithoutIn?: boolean
  notes?: string
  stocktakeSessionId?: string
}

async function findExistingByClientEventId(
  clientEventId: string,
): Promise<string | null> {
  const snap = await getDocs(
    query(txnsCol(), where('clientEventId', '==', clientEventId), limit(1)),
  )
  return snap.empty ? null : snap.docs[0].id
}

export async function applyScan(input: ApplyScanInput): Promise<{ txnId: string }> {
  const chassisNo = input.chassisNo.trim().toUpperCase()
  const clientEventId = input.clientEventId ?? newClientEventId()
  const clientTime = input.clientTime ?? Date.now()
  const source = input.source ?? 'live'

  const existing = await findExistingByClientEventId(clientEventId)
  if (existing) return { txnId: existing }

  const check = await checkScan(chassisNo, input.yardId, input.type)
  if (!check.ok) {
    if (check.code === 'duplicate_in') {
      throw new Error(check.message)
    }
    if (check.code === 'transfer' && !input.confirmTransfer) {
      throw new Error(check.message)
    }
    if (check.code === 'out_without_in' && !input.confirmOutWithoutIn) {
      throw new Error(check.message)
    }
  }

  const txnRef = doc(txnsCol())
  const unitRef = doc(getDb(), 'units', chassisNo)

  await runTransaction(getDb(), async (tx) => {
    const unitSnap = await tx.get(unitRef)
    const currentYardId = unitSnap.exists()
      ? ((unitSnap.data().yardId as string | null) ?? null)
      : null

    let type: TxnType = input.type
    let fromYardId: string | null | undefined
    let nextYardId: string | null = currentYardId

    if (input.type === 'IN') {
      if (currentYardId === input.yardId) {
        throw new Error('Already IN this yard')
      }
      if (currentYardId && currentYardId !== input.yardId) {
        type = 'TRANSFER'
        fromYardId = currentYardId
      }
      nextYardId = input.yardId
    } else {
      nextYardId = null
    }

    tx.set(txnRef, {
      chassisNo,
      yardId: input.yardId,
      type,
      staffNo: input.staffNo,
      source,
      clientTime,
      serverTime: serverTimestamp(),
      clientEventId,
      notes: input.notes ?? null,
      stocktakeSessionId: input.stocktakeSessionId ?? null,
      fromYardId: fromYardId ?? null,
    })

    tx.set(
      unitRef,
      {
        chassisNo,
        yardId: nextYardId,
        updatedAt: serverTimestamp(),
        lastTxnId: txnRef.id,
      },
      { merge: true },
    )
  })

  return { txnId: txnRef.id }
}

export async function applyAdjustment(opts: {
  chassisNo: string
  yardId: string
  type: 'ADJUST_IN' | 'ADJUST_OUT' | 'TRANSFER'
  staffNo: string
  stocktakeSessionId: string
  fromYardId?: string | null
  notes?: string
}): Promise<string> {
  const chassisNo = opts.chassisNo.trim().toUpperCase()
  const clientEventId = newClientEventId()
  const txnRef = doc(txnsCol())
  const unitRef = doc(getDb(), 'units', chassisNo)

  await runTransaction(getDb(), async (tx) => {
    let nextYardId: string | null = null
    if (opts.type === 'ADJUST_IN' || opts.type === 'TRANSFER') {
      nextYardId = opts.yardId
    }

    tx.set(txnRef, {
      chassisNo,
      yardId: opts.yardId,
      type: opts.type,
      staffNo: opts.staffNo,
      source: 'stocktake' as TxnSource,
      clientTime: Date.now(),
      serverTime: serverTimestamp(),
      clientEventId,
      notes: opts.notes ?? 'Stock take adjustment',
      stocktakeSessionId: opts.stocktakeSessionId,
      fromYardId: opts.fromYardId ?? null,
    })

    tx.set(
      unitRef,
      {
        chassisNo,
        yardId: nextYardId,
        updatedAt: serverTimestamp(),
        lastTxnId: txnRef.id,
      },
      { merge: true },
    )
  })

  return txnRef.id
}

function mapTxn(id: string, data: Record<string, unknown>): Transaction {
  return {
    id,
    chassisNo: String(data.chassisNo ?? ''),
    yardId: String(data.yardId ?? ''),
    type: data.type as TxnType,
    staffNo: String(data.staffNo ?? ''),
    source: data.source as TxnSource,
    clientTime: Number(data.clientTime ?? 0),
    serverTime:
      (data.serverTime as { toMillis?: () => number })?.toMillis?.() ??
      Number(data.serverTime ?? 0),
    clientEventId: String(data.clientEventId ?? ''),
    notes: (data.notes as string | undefined) ?? undefined,
    stocktakeSessionId:
      (data.stocktakeSessionId as string | undefined) ?? undefined,
    fromYardId: (data.fromYardId as string | null | undefined) ?? undefined,
  }
}

export async function listTransactions(max = 2000): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txnsCol(), orderBy('clientTime', 'desc'), limit(max)),
  )
  return snap.docs.map((d) => mapTxn(d.id, d.data()))
}

export function subscribeRecentTransactions(
  cb: (txns: Transaction[]) => void,
  max = 20,
): Unsubscribe {
  return onSnapshot(
    query(txnsCol(), orderBy('clientTime', 'desc'), limit(max)),
    (snap) => {
      cb(snap.docs.map((d) => mapTxn(d.id, d.data())))
    },
  )
}
