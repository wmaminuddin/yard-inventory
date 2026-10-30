import { useCallback, useEffect, useMemo, useState } from 'react'
import { QrScanner } from '../components/QrScanner'
import { useYards } from '../hooks/useYards'
import { isFirebaseConfigured } from '../lib/firebase'
import type { ReviewAction, ReviewDecision, StocktakeSession } from '../lib/types'
import { ensurePinOrSet } from '../services/settings'
import {
  addFoundScan,
  buildReviewBuckets,
  confirmStocktake,
  listOpenSessionsForYard,
  recordMidCountEvent,
  setSessionStatus,
  startStocktake,
  subscribeSession,
  watchMidCountForSession,
} from '../services/stocktake'

type Step = 'setup' | 'count' | 'review'

export function StocktakePage() {
  const { yards } = useYards(true)
  const [staffNo, setStaffNo] = useState('')
  const [yardId, setYardId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [session, setSession] = useState<StocktakeSession | null>(null)
  const [openSessions, setOpenSessions] = useState<StocktakeSession[]>([])
  const [step, setStep] = useState<Step>('setup')
  const [error, setError] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [decisions, setDecisions] = useState<Record<string, ReviewAction>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!yardId || !isFirebaseConfigured) return
    void listOpenSessionsForYard(yardId).then(setOpenSessions).catch((e) => {
      setError(e instanceof Error ? e.message : String(e))
    })
  }, [yardId])

  useEffect(() => {
    if (!sessionId) return
    return subscribeSession(sessionId, (s) => {
      setSession(s)
      if (s?.status === 'review') setStep('review')
      if (s?.status === 'open') setStep('count')
    })
  }, [sessionId])

  useEffect(() => {
    if (!session || session.status !== 'open') return
    const unsub = watchMidCountForSession(session, (event) => {
      void recordMidCountEvent(session.id, event)
    })
    return unsub
  }, [session])

  const buckets = useMemo(
    () => (session ? buildReviewBuckets(session) : null),
    [session],
  )

  const onFound = useCallback(
    (text: string) => {
      if (!sessionId || !staffNo) return
      void addFoundScan(sessionId, text, staffNo).catch((e) =>
        setError(e instanceof Error ? e.message : String(e)),
      )
    },
    [sessionId, staffNo],
  )

  async function handleStart() {
    setError(null)
    setBusy(true)
    try {
      const id = await startStocktake(yardId, staffNo.trim())
      setSessionId(id)
      setStep('count')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(id: string) {
    setSessionId(id)
    setStep('count')
  }

  async function goReview() {
    if (!sessionId) return
    await setSessionStatus(sessionId, 'review')
    setStep('review')
  }

  function setAction(chassisNo: string, action: ReviewAction) {
    setDecisions((d) => ({ ...d, [chassisNo]: action }))
  }

  async function handleConfirm() {
    if (!session || !buckets) return
    setBusy(true)
    setError(null)
    try {
      const pinResult = await ensurePinOrSet(pin)
      if (pinResult === 'invalid') {
        throw new Error('Invalid admin PIN (use 4–8 digits)')
      }
      const list: ReviewDecision[] = []
      for (const c of buckets.missing) {
        list.push({
          chassisNo: c,
          bucket: 'missing',
          action: decisions[c] ?? 'adjust_out',
        })
      }
      for (const c of buckets.extra) {
        list.push({
          chassisNo: c,
          bucket: 'extra',
          action: decisions[c] ?? 'adjust_in',
        })
      }
      for (const c of buckets.moved) {
        list.push({
          chassisNo: c,
          bucket: 'moved',
          action: decisions[c] ?? 'skip',
        })
      }
      for (const c of buckets.arrived) {
        list.push({
          chassisNo: c,
          bucket: 'arrived',
          action: decisions[c] ?? 'skip',
        })
      }
      await confirmStocktake({
        sessionId: session.id,
        decisions: list,
        confirmedBy: staffNo || 'admin',
      })
      setStep('setup')
      setSessionId(null)
      setSession(null)
      setPin('')
      alert(
        pinResult === 'set'
          ? 'PIN saved and stock take confirmed.'
          : 'Stock take confirmed. Adjustments written.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (step === 'setup') {
    return (
      <div className="panel">
        <h1>Stock take</h1>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!staffNo.trim() || !yardId) return
          }}
        >
          <label>
            Staff number
            <input value={staffNo} onChange={(e) => setStaffNo(e.target.value)} required />
          </label>
          <label>
            Yard
            <select value={yardId} onChange={(e) => setYardId(e.target.value)} required>
              <option value="">Select yard…</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="err">{error}</p>}
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={!staffNo || !yardId || busy}
              onClick={() => void handleStart()}
            >
              Start new session
            </button>
          </div>
          {openSessions.length > 0 && (
            <div className="join-list">
              <h2>Open sessions</h2>
              {openSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="home-card"
                  onClick={() => void handleJoin(s.id)}
                >
                  Join · started by {s.startedByStaffNo} · status {s.status}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    )
  }

  if (step === 'count' && session) {
    const foundCount = Object.keys(session.found).length
    return (
      <div className="panel">
        <div className="scan-meta">
          <div>
            Counting · expected {session.expectedChassis.length} · found {foundCount}
            {session.midCountEvents.length > 0 && (
              <span className="pill warn">Mid-count {session.midCountEvents.length}</span>
            )}
          </div>
          <button type="button" className="primary" onClick={() => void goReview()}>
            Review
          </button>
        </div>
        {session.midCountEvents.length > 0 && (
          <div className="banner banner-warn">
            Units moved or arrived during count — highlighted in review.
          </div>
        )}
        {error && <p className="err">{error}</p>}
        <QrScanner onScan={onFound} />
        <ul className="compact-list">
          {Object.values(session.found)
            .sort((a, b) => b.scannedAt - a.scannedAt)
            .slice(0, 30)
            .map((f) => (
              <li key={f.chassisNo}>
                {f.chassisNo} <span className="muted">by {f.staffNo}</span>
              </li>
            ))}
        </ul>
      </div>
    )
  }

  if (step === 'review' && session && buckets) {
    const renderBucket = (
      title: string,
      items: string[],
      defaultAction: ReviewAction,
      options: ReviewAction[],
    ) => (
      <section className="bucket" key={title}>
        <h3>
          {title} ({items.length})
        </h3>
        {items.length === 0 && <p className="muted">None</p>}
        {items.map((c) => (
          <div className="bucket-row" key={c}>
            <code>{c}</code>
            <select
              value={decisions[c] ?? defaultAction}
              onChange={(e) => setAction(c, e.target.value as ReviewAction)}
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>
    )

    return (
      <div className="panel">
        <h1>Review stock take</h1>
        <p className="muted">
          Matched {buckets.matched.length}. Confirm adjustments with admin PIN. Dashboard stock
          changes only after confirm.
        </p>
        {renderBucket('Missing', buckets.missing, 'adjust_out', [
          'adjust_out',
          'skip',
        ])}
        {renderBucket('Extra', buckets.extra, 'adjust_in', ['adjust_in', 'skip'])}
        {renderBucket('Moved during count', buckets.moved, 'skip', [
          'adjust_out',
          'skip',
        ])}
        {renderBucket('Arrived during count', buckets.arrived, 'skip', [
          'adjust_in',
          'skip',
        ])}
        <label>
          Admin PIN (4–8 digits; first use sets the PIN)
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        {error && <p className="err">{error}</p>}
        <div className="row">
          <button
            type="button"
            className="ghost"
            onClick={() => void setSessionStatus(session.id, 'open').then(() => setStep('count'))}
          >
            Back to count
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || !pin}
            onClick={() => void handleConfirm()}
          >
            Confirm adjustments
          </button>
        </div>
      </div>
    )
  }

  return <p>Loading…</p>
}
