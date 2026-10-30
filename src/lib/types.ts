export type TxnType = 'IN' | 'OUT' | 'ADJUST_IN' | 'ADJUST_OUT' | 'TRANSFER'
export type TxnSource = 'live' | 'offline' | 'stocktake'
export type StocktakeStatus = 'open' | 'review' | 'confirmed' | 'cancelled'

export interface Yard {
  id: string
  name: string
  active: boolean
  createdAt: number
  updatedAt: number
}

export interface Unit {
  chassisNo: string
  yardId: string | null
  updatedAt: number
  lastTxnId: string | null
}

export interface Transaction {
  id: string
  chassisNo: string
  yardId: string
  type: TxnType
  staffNo: string
  source: TxnSource
  clientTime: number
  serverTime: number
  clientEventId: string
  notes?: string
  stocktakeSessionId?: string
  fromYardId?: string | null
}

export interface FoundScan {
  chassisNo: string
  scannedAt: number
  staffNo: string
}

export type MidCountKind = 'moved' | 'arrived'

export interface MidCountEvent {
  chassisNo: string
  kind: MidCountKind
  at: number
  note?: string
}

export type ReviewAction =
  | 'adjust_out'
  | 'adjust_in'
  | 'transfer'
  | 'skip'

export interface ReviewDecision {
  chassisNo: string
  bucket: string
  action: ReviewAction
  toYardId?: string
}

export interface StocktakeSession {
  id: string
  yardId: string
  status: StocktakeStatus
  expectedChassis: string[]
  found: Record<string, FoundScan>
  midCountEvents: MidCountEvent[]
  reviewDecisions: ReviewDecision[]
  startedAt: number
  startedByStaffNo: string
  confirmedAt?: number
  confirmedBy?: string
}

export interface AppSettings {
  adminPinHash: string
  pinSetAt?: number
}

export interface QueuedScan {
  clientEventId: string
  chassisNo: string
  yardId: string
  type: 'IN' | 'OUT'
  staffNo: string
  clientTime: number
  confirmTransfer?: boolean
  confirmOutWithoutIn?: boolean
  syncStatus: 'pending' | 'syncing' | 'failed'
  lastError?: string
}

export type ScanCheckResult =
  | { ok: true }
  | {
      ok: false
      code: 'duplicate_in' | 'transfer' | 'out_without_in'
      message: string
      currentYardId?: string | null
    }
