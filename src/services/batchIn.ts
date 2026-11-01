import { applyScan, checkScan } from './inventory'

export type BatchInStatus = 'ok' | 'transferred' | 'skipped' | 'failed'

export interface BatchInRowResult {
  chassisNo: string
  status: BatchInStatus
  message: string
  txnId?: string
}

export interface BatchInProgress {
  processed: number
  total: number
  current?: string
}

export async function runBatchIn(opts: {
  yardId: string
  staffNo: string
  chassisNos: string[]
  onProgress?: (p: BatchInProgress) => void
}): Promise<BatchInRowResult[]> {
  const results: BatchInRowResult[] = []
  const total = opts.chassisNos.length

  for (let i = 0; i < opts.chassisNos.length; i++) {
    const chassisNo = opts.chassisNos[i]
    opts.onProgress?.({ processed: i, total, current: chassisNo })

    try {
      const check = await checkScan(chassisNo, opts.yardId, 'IN')
      if (!check.ok && check.code === 'duplicate_in') {
        results.push({
          chassisNo,
          status: 'skipped',
          message: check.message,
        })
        continue
      }

      const wasTransfer = !check.ok && check.code === 'transfer'
      const { txnId } = await applyScan({
        chassisNo,
        yardId: opts.yardId,
        type: 'IN',
        staffNo: opts.staffNo,
        source: 'batch',
        confirmTransfer: true,
        notes: wasTransfer
          ? `Batch IN transfer from ${check.currentYardId ?? 'other yard'}`
          : 'Batch IN',
      })

      results.push({
        chassisNo,
        status: wasTransfer ? 'transferred' : 'ok',
        message: wasTransfer ? 'Transferred into yard' : 'IN recorded',
        txnId,
      })
    } catch (e) {
      results.push({
        chassisNo,
        status: 'failed',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  opts.onProgress?.({ processed: total, total })
  return results
}
