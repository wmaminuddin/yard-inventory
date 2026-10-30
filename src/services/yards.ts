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

export async function listYards(): Promise<Yard[]> {
  const snap = await getDocs(query(yardsCol(), orderBy('name')))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      name: data.name as string,
      active: Boolean(data.active),
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? 0,
      updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
    }
  })
}

export function subscribeYards(cb: (yards: Yard[]) => void): Unsubscribe {
  return onSnapshot(query(yardsCol(), orderBy('name')), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name as string,
          active: Boolean(data.active),
          createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
          updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? Date.now(),
        }
      }),
    )
  })
}

export async function createYard(name: string): Promise<string> {
  const ref = await addDoc(yardsCol(), {
    name: name.trim(),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateYard(
  id: string,
  patch: Partial<Pick<Yard, 'name' | 'active'>>,
): Promise<void> {
  await updateDoc(doc(getDb(), 'yards', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}
