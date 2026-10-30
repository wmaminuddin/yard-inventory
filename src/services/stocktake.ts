import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import type {
  MidCountEvent,
  ReviewDecision,
  StocktakeSession,
  StocktakeStatus,
} from '../lib/types'
import { applyAdjustment, listUnitsInYard } from './inventory'

function sessionsCol() {
  return collection(getDb(), 'stocktakeSessions')
}

function mapSession(id: string, data: Record<string, unknown>): StocktakeSession {
  return {
    id,
    yardId: String(data.yardId ?? ''),
    status: data.status as StocktakeStatus,
    expectedChassis: (data.expectedChassis as string[]) ?? [],
    found: (data.found as StocktakeSession['found']) ?? {},
    midCountEvents: (data.midCountEvents as MidCountEvent[]) ?? [],
    reviewDecisions: (data.reviewDecisions as ReviewDecision[]) ?? [],
    startedAt:
      (data.startedAt as { toMillis?: () => number })?.toMillis?.() ??
      Number(data.startedAt ?? 0),
    startedByStaffNo: String(data.startedByStaffNo ?? ''),
    confirmedAt:
      (data.confirmedAt as { toMillis?: () => number })?.toMillis?.() ??
      undefined,
    confirmedBy: (data.confirmedBy as string | undefined) ?? undefined,
  }
}

export async function listOpenSessionsForYard(
  yardId: string,
): Promise<StocktakeSession[]> {
  const snap = await getDocs(query(sessionsCol(), where('yardId', '==', yardId)))
  return snap.docs
    .map((d) => mapSession(d.id, d.data()))
    .filter((s) => s.status === 'open' || s.status === 'review')
}

export async function listAllSessions(): Promise<StocktakeSession[]> {
  const snap = await getDocs(query(sessionsCol(), orderBy('startedAt', 'desc')))
  return snap.docs.map((d) => mapSession(d.id, d.data()))
}

export function subscribeSession(
  id: string,
  cb: (session: StocktakeSession | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getDb(), 'stocktakeSessions', id), (snap) => {
    if (!snap.exists()) {
      cb(null)
      return
    }
    cb(mapSession(snap.id, snap.data()))
  })
}

export async function startStocktake(
  yardId: string,
  staffNo: string,
): Promise<string> {
  const open = await listOpenSessionsForYard(yardId)
  if (open.length > 0) {
    throw new Error('An open stock take already exists for this yard — join it instead')
  }
  const units = await listUnitsInYard(yardId)
  const expectedChassis = units.map((u) => u.chassisNo).sort()
  const ref = doc(sessionsCol())
  await setDoc(ref, {
    yardId,
    status: 'open',
    expectedChassis,
    found: {},
    midCountEvents: [],
    reviewDecisions: [],
    startedAt: serverTimestamp(),
    startedByStaffNo: staffNo,
  })
  return ref.id
}

export async function addFoundScan(
  sessionId: string,
  chassisNo: string,
  staffNo: string,
): Promise<void> {
  const key = chassisNo.trim().toUpperCase()
  const ref = doc(getDb(), 'stocktakeSessions', sessionId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Session not found')
  const data = snap.data()
  if (data.status !== 'open') throw new Error('Session is not open for scanning')
  const found = { ...(data.found as Record<string, unknown>) }
  if (found[key]) return
  found[key] = {
    chassisNo: key,
    scannedAt: Date.now(),
    staffNo,
  }
  await updateDoc(ref, { found })
}

export async function recordMidCountEvent(
  sessionId: string,
  event: MidCountEvent,
): Promise<void> {
  const ref = doc(getDb(), 'stocktakeSessions', sessionId)
  await updateDoc(ref, {
    midCountEvents: arrayUnion(event),
  })
}

/** Watch unit movements for open sessions of a yard and annotate mid-count events. */
export function watchMidCountForSession(
  session: StocktakeSession,
  onEvent: (event: MidCountEvent) => void,
): Unsubscribe {
  const expected = new Set(session.expectedChassis)
  return onSnapshot(
    query(collection(getDb(), 'units'), where('yardId', '==', session.yardId)),
    (snap) => {
      const current = new Set(snap.docs.map((d) => d.id))
      for (const chassis of expected) {
        if (!current.has(chassis)) {
          const already = session.midCountEvents.some(
            (e) => e.chassisNo === chassis && e.kind === 'moved',
          )
          if (!already && !session.found[chassis]) {
            onEvent({
              chassisNo: chassis,
              kind: 'moved',
              at: Date.now(),
              note: 'Left yard during stock take',
            })
          }
        }
      }
      for (const chassis of current) {
        if (!expected.has(chassis) && !session.found[chassis]) {
          const already = session.midCountEvents.some(
            (e) => e.chassisNo === chassis && e.kind === 'arrived',
          )
          if (!already) {
            onEvent({
              chassisNo: chassis,
              kind: 'arrived',
              at: Date.now(),
              note: 'Arrived during stock take',
            })
          }
        }
      }
    },
  )
}

export function buildReviewBuckets(session: StocktakeSession) {
  const expected = new Set(session.expectedChassis)
  const found = new Set(Object.keys(session.found))
  const moved = new Set(
    session.midCountEvents.filter((e) => e.kind === 'moved').map((e) => e.chassisNo),
  )
  const arrived = new Set(
    session.midCountEvents.filter((e) => e.kind === 'arrived').map((e) => e.chassisNo),
  )

  const matched: string[] = []
  const missing: string[] = []
  const extra: string[] = []
  const movedList: string[] = []
  const arrivedList: string[] = []

  for (const c of expected) {
    if (found.has(c)) matched.push(c)
    else if (moved.has(c)) movedList.push(c)
    else missing.push(c)
  }
  for (const c of found) {
    if (!expected.has(c)) {
      if (arrived.has(c)) arrivedList.push(c)
      else extra.push(c)
    }
  }

  return { matched, missing, extra, moved: movedList, arrived: arrivedList }
}

export async function setSessionStatus(
  sessionId: string,
  status: StocktakeStatus,
): Promise<void> {
  await updateDoc(doc(getDb(), 'stocktakeSessions', sessionId), { status })
}

export async function confirmStocktake(opts: {
  sessionId: string
  decisions: ReviewDecision[]
  confirmedBy: string
}): Promise<void> {
  const ref = doc(getDb(), 'stocktakeSessions', opts.sessionId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Session not found')
  const session = mapSession(snap.id, snap.data())

  for (const d of opts.decisions) {
    if (d.action === 'skip') continue
    if (d.action === 'adjust_out') {
      await applyAdjustment({
        chassisNo: d.chassisNo,
        yardId: session.yardId,
        type: 'ADJUST_OUT',
        staffNo: opts.confirmedBy,
        stocktakeSessionId: session.id,
        notes: `Stock take: ${d.bucket}`,
      })
    } else if (d.action === 'adjust_in') {
      await applyAdjustment({
        chassisNo: d.chassisNo,
        yardId: session.yardId,
        type: 'ADJUST_IN',
        staffNo: opts.confirmedBy,
        stocktakeSessionId: session.id,
        notes: `Stock take: ${d.bucket}`,
      })
    } else if (d.action === 'transfer') {
      await applyAdjustment({
        chassisNo: d.chassisNo,
        yardId: d.toYardId ?? session.yardId,
        type: 'TRANSFER',
        staffNo: opts.confirmedBy,
        stocktakeSessionId: session.id,
        fromYardId: session.yardId,
        notes: `Stock take transfer: ${d.bucket}`,
      })
    }
  }

  await updateDoc(ref, {
    status: 'confirmed',
    reviewDecisions: opts.decisions,
    confirmedAt: serverTimestamp(),
    confirmedBy: opts.confirmedBy,
  })
}
