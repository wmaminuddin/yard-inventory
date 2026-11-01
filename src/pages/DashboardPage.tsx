import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RingGauge, capacityTone } from '../components/RingGauge'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Unit, Yard } from '../lib/types'
import { subscribeUnits } from '../services/inventory'
import { listOpenSessionsForYard } from '../services/stocktake'
import { subscribeYards } from '../services/yards'

const PAGE_SIZE = 4
const ROTATE_MS = 10000
const SWIPE_MIN_PX = 50

function chunkYards<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]]
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size))
  }
  return pages
}

export function DashboardPage() {
  const [yards, setYards] = useState<Yard[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [openByYard, setOpenByYard] = useState<Record<string, number>>({})
  const [clock, setClock] = useState(new Date())
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const pointerStartX = useRef<number | null>(null)
  const pauseTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const u1 = subscribeYards(setYards)
    const u2 = subscribeUnits(setUnits)
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => {
      u1()
      u2()
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

  const activeYards = useMemo(
    () => [...yards.filter((y) => y.active)].sort((a, b) => a.name.localeCompare(b.name)),
    [yards],
  )

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

  const totalStock = useMemo(
    () => [...counts.values()].reduce((a, b) => a + b, 0),
    [counts],
  )

  const totalCapacity = useMemo(
    () =>
      activeYards.reduce((sum, y) => sum + (y.maxCapacity > 0 ? y.maxCapacity : 0), 0),
    [activeYards],
  )

  const totalPct =
    totalCapacity > 0 ? Math.round((totalStock / totalCapacity) * 100) : null
  const totalTone = capacityTone(totalStock, totalCapacity)

  const pages = useMemo(() => chunkYards(activeYards, PAGE_SIZE), [activeYards])
  const pageCount = Math.max(1, pages.length)

  useEffect(() => {
    setPage((p) => (p >= pageCount ? 0 : p))
  }, [pageCount])

  const pauseRotationBriefly = useCallback(() => {
    setPaused(true)
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    pauseTimer.current = window.setTimeout(() => setPaused(false), ROTATE_MS)
  }, [])

  useEffect(() => {
    if (paused || pageCount <= 1) return
    const t = window.setInterval(() => {
      setPage((p) => (p + 1) % pageCount)
    }, ROTATE_MS)
    return () => window.clearInterval(t)
  }, [paused, pageCount])

  useEffect(
    () => () => {
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    },
    [],
  )

  const goPage = useCallback(
    (next: number) => {
      setPage(((next % pageCount) + pageCount) % pageCount)
      pauseRotationBriefly()
    },
    [pageCount, pauseRotationBriefly],
  )

  function onPointerDown(e: React.PointerEvent) {
    pointerStartX.current = e.clientX
  }

  function onPointerUp(e: React.PointerEvent) {
    if (pointerStartX.current == null) return
    const dx = e.clientX - pointerStartX.current
    pointerStartX.current = null
    if (Math.abs(dx) < SWIPE_MIN_PX || pageCount <= 1) return
    if (dx < 0) goPage(page + 1)
    else goPage(page - 1)
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="dashboard">
        <p>Configure Firebase to show live stock.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  const pageYards = pages[page] ?? []

  return (
    <div className="dashboard dashboard-rings">
      <header className="dash-header dash-header-slim">
        <div>
          <p className="dash-kicker">Yard stock levels</p>
          <h1>External yards</h1>
        </div>
        <div className="dash-clock muted">{clock.toLocaleTimeString()}</div>
      </header>

      <div className="dash-ring-layout">
        <article className={`dash-hero dash-card-${totalTone}`}>
          <p className="dash-panel-label">All yards</p>
          <RingGauge
            size={280}
            stroke={22}
            percent={totalPct}
            primary={String(totalStock)}
            secondary={totalPct != null ? `${totalPct}%` : undefined}
            tone={totalTone}
          />
          <p className="dash-hero-caption">
            {totalCapacity > 0
              ? `${totalStock} units · ${totalCapacity} capacity`
              : `${totalStock} units · no capacity set`}
          </p>
        </article>

        <div
          className="dash-yard-pager"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pointerStartX.current = null
          }}
        >
          <div className="dash-yard-grid">
            {pageYards.map((y) => {
              const count = counts.get(y.id) ?? 0
              const max = y.maxCapacity ?? 0
              const pct = max > 0 ? Math.round((count / max) * 100) : null
              const tone = capacityTone(count, max)
              return (
                <article key={y.id} className={`dash-yard-tile dash-card-${tone}`}>
                  <h2>{y.name}</h2>
                  <RingGauge
                    size={140}
                    stroke={12}
                    percent={pct}
                    primary={pct != null ? `${pct}%` : String(count)}
                    secondary={pct != null ? String(count) : undefined}
                    tone={tone}
                  />
                  <p className="dash-yard-meta">
                    {max > 0 ? `cap ${max}` : 'no cap'}
                    {openByYard[y.id] ? ' · stock take' : ''}
                  </p>
                </article>
              )
            })}
            {activeYards.length === 0 && (
              <p className="muted dash-empty">No active yards — add some in Admin.</p>
            )}
            {activeYards.length > 0 &&
              pageYards.length < PAGE_SIZE &&
              Array.from({ length: PAGE_SIZE - pageYards.length }).map((_, i) => (
                <div key={`pad-${i}`} className="dash-yard-tile dash-yard-pad" />
              ))}
          </div>

          {pageCount > 1 && (
            <div className="dash-dots" role="tablist" aria-label="Yard pages">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === page ? 'dash-dot active' : 'dash-dot'}
                  aria-label={`Page ${i + 1}`}
                  aria-selected={i === page}
                  onClick={() => goPage(i)}
                />
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <p className="dash-swipe-hint muted">Swipe yards · auto-rotates every 10s</p>
          )}
        </div>
      </div>
    </div>
  )
}
