import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import type { Yard } from '../lib/types'

function yardsCol() {
  return collection(getDb(), 'yards')
}

function mapYard(id: string, data: Record<string, unknown>): Yard {
  return {
    id,
    name: data.name as string,
    active: Boolean(data.active),
    maxCapacity: Number(data.maxCapacity ?? 0) || 0,
    createdAt:
      (data.createdAt as { toMillis?: () => number })?.toMillis?.() ??
      Number(data.createdAt ?? 0),
    updatedAt:
      (data.updatedAt as { toMillis?: () => number })?.toMillis?.() ??
      Number(data.updatedAt ?? 0),
  }
}

export async function listYards(): Promise<Yard[]> {
  const snap = await getDocs(query(yardsCol(), orderBy('name')))
  return snap.docs.map((d) => mapYard(d.id, d.data()))
}

export function subscribeYards(cb: (yards: Yard[]) => void): Unsubscribe {
  return onSnapshot(query(yardsCol(), orderBy('name')), (snap) => {
    cb(snap.docs.map((d) => mapYard(d.id, d.data())))
  })
}

export async function createYard(name: string, maxCapacity = 0): Promise<string> {
  const cap = Math.max(0, Math.floor(Number(maxCapacity) || 0))
  const ref = await addDoc(yardsCol(), {
    name: name.trim(),
    active: true,
    maxCapacity: cap,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateYard(
  id: string,
  patch: Partial<Pick<Yard, 'name' | 'active' | 'maxCapacity'>>,
): Promise<void> {
  const data: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }
  if (patch.name !== undefined) data.name = patch.name
  if (patch.active !== undefined) data.active = patch.active
  if (patch.maxCapacity !== undefined) {
    data.maxCapacity = Math.max(0, Math.floor(Number(patch.maxCapacity) || 0))
  }
  await updateDoc(doc(getDb(), 'yards', id), data)
}
