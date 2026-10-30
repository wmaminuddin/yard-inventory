import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { QueuedScan } from './types'

interface QueueDb extends DBSchema {
  scans: {
    key: string
    value: QueuedScan
    indexes: { 'by-status': string }
  }
}

const DB_NAME = 'yard-inventory-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<QueueDb>> | null = null

function getQueueDb() {
  if (!dbPromise) {
    dbPromise = openDB<QueueDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('scans', { keyPath: 'clientEventId' })
        store.createIndex('by-status', 'syncStatus')
      },
    })
  }
  return dbPromise
}

export async function enqueueScan(
  scan: Omit<QueuedScan, 'syncStatus'>,
): Promise<void> {
  const db = await getQueueDb()
  await db.put('scans', { ...scan, syncStatus: 'pending' })
}

export async function listPendingScans(): Promise<QueuedScan[]> {
  const db = await getQueueDb()
  const all = await db.getAll('scans')
  return all
    .filter((s) => s.syncStatus === 'pending' || s.syncStatus === 'failed')
    .sort((a, b) => a.clientTime - b.clientTime)
}

export async function countPendingScans(): Promise<number> {
  return (await listPendingScans()).length
}

export async function markScanSyncing(id: string): Promise<void> {
  const db = await getQueueDb()
  const row = await db.get('scans', id)
  if (!row) return
  await db.put('scans', { ...row, syncStatus: 'syncing', lastError: undefined })
}

export async function removeSyncedScan(id: string): Promise<void> {
  const db = await getQueueDb()
  await db.delete('scans', id)
}

export async function markScanFailed(id: string, error: string): Promise<void> {
  const db = await getQueueDb()
  const row = await db.get('scans', id)
  if (!row) return
  await db.put('scans', { ...row, syncStatus: 'failed', lastError: error })
}

export function newClientEventId(): string {
  return crypto.randomUUID()
}
