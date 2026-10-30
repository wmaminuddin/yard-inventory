import { useCallback, useMemo, useState } from 'react'
import { QrScanner } from '../components/QrScanner'
import { enqueueScan, newClientEventId } from '../lib/offlineQueue'
import { subscribePendingCount } from '../services/sync'
import { useEffect } from 'react'
import { useYards } from '../hooks/useYards'
import { applyScan, checkScan } from '../services/inventory'
import { isFirebaseConfigured } from '../lib/firebase'

type Mode = 'IN' | 'OUT'

const SESSION_KEY = 'yard-scan-session'

interface Session {
  staffNo: string
  yardId: string
  mode: Mode
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function ScanPage() {
  const { yards, loading } = useYards(true)
  const [staffNo, setStaffNo] = useState(loadSession()?.staffNo ?? '')
  const [yardId, setYardId] = useState(loadSession()?.yardId ?? '')
  const [mode, setMode] = useState<Mode>(loadSession()?.mode ?? 'IN')
  const [ready, setReady] = useState(Boolean(loadSession()?.staffNo && loadSession()?.yardId))
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(0)
  const [awaitConfirm, setAwaitConfirm] = useState<{
    chassisNo: string
    code: 'transfer' | 'out_without_in'
    message: string
  } | null>(null)

  useEffect(() => subscribePendingCount(setPending), [])

  const yardName = useMemo(
    () => yards.find((y) => y.id === yardId)?.name ?? yardId,
    [yards, yardId],
  )

  function startSession(e: React.FormEvent) {
    e.preventDefault()
    if (!staffNo.trim() || !yardId) return
    const s: Session = { staffNo: staffNo.trim(), yardId, mode }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setReady(true)
    setStatus(null)
  }

  const processChassis = useCallback(
    async (
      chassisRaw: string,
      opts?: { confirmTransfer?: boolean; confirmOutWithoutIn?: boolean },
    ) => {
      if (!isFirebaseConfigured || busy) return
      const chassisNo = chassisRaw.trim().toUpperCase()
      if (!chassisNo) return
      setBusy(true)
      setStatus({ kind: 'info', text: `Processing ${chassisNo}…` })
      try {
        if (!navigator.onLine) {
          await enqueueScan({
            clientEventId: newClientEventId(),
            chassisNo,
            yardId,
            type: mode,
            staffNo,
            clientTime: Date.now(),
            confirmTransfer: opts?.confirmTransfer,
            confirmOutWithoutIn: opts?.confirmOutWithoutIn,
          })
          setStatus({
            kind: 'ok',
            text: `Queued ${mode} ${chassisNo} (offline)`,
          })
          setAwaitConfirm(null)
          return
        }

        const check = await checkScan(chassisNo, yardId, mode)
        if (!check.ok) {
          if (check.code === 'duplicate_in') {
            setStatus({ kind: 'err', text: check.message })
            return
          }
          if (
            (check.code === 'transfer' && !opts?.confirmTransfer) ||
            (check.code === 'out_without_in' && !opts?.confirmOutWithoutIn)
          ) {
            setAwaitConfirm({
              chassisNo,
              code: check.code,
              message: check.message,
            })
            setStatus({ kind: 'info', text: check.message })
            return
          }
        }

        await applyScan({
          chassisNo,
          yardId,
          type: mode,
          staffNo,
          source: 'live',
          confirmTransfer: opts?.confirmTransfer,
          confirmOutWithoutIn: opts?.confirmOutWithoutIn,
        })
        setAwaitConfirm(null)
        setStatus({ kind: 'ok', text: `${mode} recorded: ${chassisNo}` })
      } catch (e) {
        setStatus({
          kind: 'err',
          text: e instanceof Error ? e.message : String(e),
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, mode, staffNo, yardId],
  )

  const onScan = useCallback(
    (text: string) => {
      void processChassis(text)
    },
    [processChassis],
  )

  if (!ready) {
    return (
      <div className="panel">
        <h1>Scan setup</h1>
        <form className="stack" onSubmit={startSession}>
          <label>
            Staff number
            <input
              value={staffNo}
              onChange={(e) => setStaffNo(e.target.value)}
              required
              inputMode="numeric"
              autoComplete="username"
            />
          </label>
          <label>
            Yard
            <select
              value={yardId}
              onChange={(e) => setYardId(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select yard…</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="mode-toggle">
            <legend>Direction</legend>
            <label>
              <input
                type="radio"
                checked={mode === 'IN'}
                onChange={() => setMode('IN')}
              />
              IN
            </label>
            <label>
              <input
                type="radio"
                checked={mode === 'OUT'}
                onChange={() => setMode('OUT')}
              />
              OUT
            </label>
          </fieldset>
          <button type="submit" className="primary" disabled={!yards.length}>
            Open camera
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="panel scan-panel">
      <div className="scan-meta">
        <div>
          <strong>{mode}</strong> · {yardName} · Staff {staffNo}
          {pending > 0 && <span className="pill">Queue {pending}</span>}
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY)
            setReady(false)
          }}
        >
          Change
        </button>
      </div>

      <div className={`flash flash-${status?.kind ?? 'idle'}`}>
        {status?.text ?? 'Point camera at chassis QR'}
      </div>

      {awaitConfirm && (
        <div className="confirm-box">
          <p>{awaitConfirm.message}</p>
          <div className="row">
            <button type="button" className="ghost" onClick={() => setAwaitConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={() =>
                void processChassis(awaitConfirm.chassisNo, {
                  confirmTransfer: awaitConfirm.code === 'transfer',
                  confirmOutWithoutIn: awaitConfirm.code === 'out_without_in',
                })
              }
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      <QrScanner onScan={onScan} active={!awaitConfirm && !busy} />
    </div>
  )
}
