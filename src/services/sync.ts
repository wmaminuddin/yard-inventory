import {
  countPendingScans,
  listPendingScans,
  markScanFailed,
  markScanSyncing,
  removeSyncedScan,
} from '../lib/offlineQueue'
import { applyScan } from './inventory'

let syncing = false
const listeners = new Set<(n: number) => void>()

export function subscribePendingCount(cb: (n: number) => void): () => void {
  listeners.add(cb)
  void refreshPendingCount()
  return () => listeners.delete(cb)
}

async function refreshPendingCount() {
  const n = await countPendingScans()
  listeners.forEach((cb) => cb(n))
}

export async function flushOfflineQueue(): Promise<{ ok: number; failed: number }> {
  if (syncing || !navigator.onLine) {
    return { ok: 0, failed: 0 }
  }
  syncing = true
  let ok = 0
  let failed = 0
  try {
    const pending = await listPendingScans()
    for (const item of pending) {
      await markScanSyncing(item.clientEventId)
      try {
        await applyScan({
          chassisNo: item.chassisNo,
          yardId: item.yardId,
          type: item.type,
          staffNo: item.staffNo,
          source: 'offline',
          clientTime: item.clientTime,
          clientEventId: item.clientEventId,
          confirmTransfer: item.confirmTransfer,
          confirmOutWithoutIn: item.confirmOutWithoutIn,
        })
        await removeSyncedScan(item.clientEventId)
        ok += 1
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await markScanFailed(item.clientEventId, msg)
        failed += 1
      }
    }
  } finally {
    syncing = false
    await refreshPendingCount()
  }
  return { ok, failed }
}

export function startSyncLoop(): () => void {
  const onOnline = () => {
    void flushOfflineQueue()
  }
  window.addEventListener('online', onOnline)
  const timer = window.setInterval(() => {
    if (navigator.onLine) void flushOfflineQueue()
  }, 15000)
  if (navigator.onLine) void flushOfflineQueue()
  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(timer)
  }
}
