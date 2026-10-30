import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import { hashPin, verifyPin } from '../lib/pin'
import type { AppSettings } from '../lib/types'

const SETTINGS_PATH = ['settings', 'app'] as const

export async function getSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(doc(getDb(), ...SETTINGS_PATH))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    adminPinHash: data.adminPinHash as string,
    pinSetAt: data.pinSetAt?.toMillis?.() ?? data.pinSetAt,
  }
}

export async function setAdminPin(pin: string): Promise<void> {
  const adminPinHash = await hashPin(pin)
  await setDoc(
    doc(getDb(), ...SETTINGS_PATH),
    {
      adminPinHash,
      pinSetAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function checkAdminPin(pin: string): Promise<boolean> {
  const settings = await getSettings()
  if (!settings?.adminPinHash) {
    // First-run: any 4+ digit pin can be set by caller; treat empty as unset
    return false
  }
  return verifyPin(pin, settings.adminPinHash)
}

export async function ensurePinOrSet(pin: string): Promise<'ok' | 'set' | 'invalid'> {
  if (!/^\d{4,8}$/.test(pin)) return 'invalid'
  const settings = await getSettings()
  if (!settings?.adminPinHash) {
    await setAdminPin(pin)
    return 'set'
  }
  return (await verifyPin(pin, settings.adminPinHash)) ? 'ok' : 'invalid'
}
