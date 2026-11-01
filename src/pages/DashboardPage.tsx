import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Transaction, Unit, Yard } from '../lib/types'
import { subscribeRecentTransactions, subscribeUnits } from '../services/inventory'
import { listOpenSessionsForYard } from '../services/stocktake'
import { subscribeYards } from '../services/yards'

function capacityClass(count: number, max: number): string {
  if (max <= 0) return ''
  if (count > max) return 'over'
  if (count / max >= 0.9) return 'warn'
  return 'ok'
}

export function DashboardPage() {
  const [yards, setYards] = useState<Yard[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [recent, setRecent] = useState<Transaction[]>([])
  const [openByYard, setOpenByYard] = useState<Record<string, number>>({})
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const u1 = subscribeYards(setYards)
    const u2 = subscribeUnits(setUnits)
    const u3 = subscribeRecentTransactions(setRecent, 12)
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => {
      u1()
      u2()
      u3()
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false
    async function loadOpen() {
      const map: Record<string, number> = {}
      for (const y of yards.filter((x) => x.active)) {
        const sessions = await listOpenSessionsForYard(y.id)
        map[y.id] = sessions.length
      }
      if (!cancelled) setOpenByYard(map)
    }
    void loadOpen()
    const timer = window.setInterval(() => void loadOpen(), 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [yards])

  const activeYards = useMemo(() => yards.filter((y) => y.active), [yards])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const y of activeYards) map.set(y.id, 0)
    for (const u of units) {
      if (u.yardId && map.has(u.yardId)) {
        map.set(u.yardId, (map.get(u.yardId) ?? 0) + 1)
      }
    }
    return map
  }, [activeYards, units])

  const total = useMemo(
    () => [...counts.values()].reduce((a, b) => a + b, 0),
    [counts],
  )

  const yardName = (id: string) => yards.find((y) => y.id === id)?.name ?? id

  if (!isFirebaseConfigured) {
    return (
      <div className="dashboard">
        <p>Configure Firebase to show live stock.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Yard stock levels</p>
          <h1>External yards</h1>
        </div>
        <div className="dash-clock">
          <div className="dash-total">{total}</div>
          <div className="muted">units in yards · {clock.toLocaleTimeString()}</div>
        </div>
      </header>

      <div className="dash-grid">
        {activeYards.map((y) => {
          const count = counts.get(y.id) ?? 0
          const max = y.maxCapacity ?? 0
          const pct = max > 0 ? Math.round((count / max) * 100) : null
          const barPct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0
          const level = capacityClass(count, max)

          return (
            <article
              key={y.id}
              className={`dash-card${level ? ` dash-card-${level}` : ''}`}
            >
              <h2>{y.name}</h2>
              <p className="dash-count">{count}</p>
              {pct !== null ? (
                <>
                  <p className="dash-cap">
                    {pct}% of {max}
                  </p>
                  <div className="cap-bar" aria-hidden>
                    <div
                      className={`cap-bar-fill cap-bar-${level || 'ok'}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="muted">No capacity set</p>
              )}
              {openByYard[y.id] ? (
                <span className="pill warn">Stock take open</span>
              ) : (
                <span className="muted">In stock</span>
              )}
            </article>
          )
        })}
        {activeYards.length === 0 && (
          <p className="muted">No active yards — add some in Admin.</p>
        )}
      </div>

      <section className="dash-recent">
        <h3>Recent scans</h3>
        <ul>
          {recent.map((t) => (
            <li key={t.id}>
              <strong>{t.type}</strong> {t.chassisNo} · {yardName(t.yardId)} ·{' '}
              {new Date(t.clientTime).toLocaleTimeString()}
            </li>
          ))}
          {recent.length === 0 && <li className="muted">No transactions yet</li>}
        </ul>
      </section>
    </div>
  )
}
