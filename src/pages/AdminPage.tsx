import { useEffect, useMemo, useState } from 'react'
import { downloadAllCsvZipLike, downloadCsv, toCsv } from '../lib/csv'
import { isFirebaseConfigured } from '../lib/firebase'
import type { StocktakeSession, Transaction, Unit, Yard } from '../lib/types'
import { useAuth } from '../hooks/useAuth'
import { listTransactions, listUnits } from '../services/inventory'
import { getSettings, setAdminPin } from '../services/settings'
import { listAllSessions } from '../services/stocktake'
import { createYard, listYards, updateYard } from '../services/yards'

type Tab = 'transactions' | 'units' | 'yards' | 'stocktakes' | 'settings'

export function AdminPage() {
  const { user, loading: authLoading, login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('transactions')
  const [txns, setTxns] = useState<Transaction[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [yards, setYards] = useState<Yard[]>([])
  const [sessions, setSessions] = useState<StocktakeSession[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [newYard, setNewYard] = useState('')
  const [pin, setPin] = useState('')
  const [pinHas, setPinHas] = useState(false)

  async function refresh() {
    if (!isFirebaseConfigured) return
    const [t, u, y, s] = await Promise.all([
      listTransactions(),
      listUnits(),
      listYards(),
      listAllSessions(),
    ])
    setTxns(t)
    setUnits(u)
    setYards(y)
    setSessions(s)
    const settings = await getSettings()
    setPinHas(Boolean(settings?.adminPinHash))
  }

  useEffect(() => {
    if (user) void refresh().catch((e) => setMsg(String(e)))
  }, [user])

  const yardName = useMemo(() => {
    const m = new Map(yards.map((y) => [y.id, y.name]))
    return (id: string | null | undefined) => (id ? m.get(id) ?? id : '')
  }, [yards])

  const filteredTxns = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return txns
    return txns.filter((t) =>
      [t.chassisNo, t.staffNo, t.type, t.source, yardName(t.yardId), t.notes]
        .join(' ')
        .toLowerCase()
        .includes(s),
    )
  }, [txns, q, yardName])

  const filteredUnits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return units
    return units.filter((u) =>
      [u.chassisNo, yardName(u.yardId)].join(' ').toLowerCase().includes(s),
    )
  }, [units, q, yardName])

  function exportCurrent() {
    if (tab === 'transactions') {
      downloadCsv(
        'transactions.csv',
        toCsv(
          filteredTxns.map((t) => ({
            ...t,
            yardName: yardName(t.yardId),
            serverTimeIso: new Date(t.serverTime || t.clientTime).toISOString(),
          })),
        ),
      )
    } else if (tab === 'units') {
      downloadCsv(
        'units.csv',
        toCsv(
          filteredUnits.map((u) => ({
            ...u,
            yardName: yardName(u.yardId),
          })),
        ),
      )
    } else if (tab === 'yards') {
      downloadCsv('yards.csv', toCsv(yards as unknown as Record<string, unknown>[]))
    } else if (tab === 'stocktakes') {
      downloadCsv(
        'stocktakeSessions.csv',
        toCsv(
          sessions.map((s) => ({
            id: s.id,
            yardId: s.yardId,
            yardName: yardName(s.yardId),
            status: s.status,
            expectedCount: s.expectedChassis.length,
            foundCount: Object.keys(s.found).length,
            startedAt: s.startedAt,
            startedByStaffNo: s.startedByStaffNo,
            confirmedAt: s.confirmedAt ?? '',
            confirmedBy: s.confirmedBy ?? '',
          })),
        ),
      )
    }
  }

  async function exportAll() {
    setBusy(true)
    try {
      const [t, u, y, s] = await Promise.all([
        listTransactions(),
        listUnits(),
        listYards(),
        listAllSessions(),
      ])
      setTxns(t)
      setUnits(u)
      setYards(y)
      setSessions(s)
      const names = new Map(y.map((yard) => [yard.id, yard.name]))
      const yn = (id: string | null | undefined) => (id ? names.get(id) ?? id : '')
      downloadAllCsvZipLike([
        {
          name: 'transactions.csv',
          csv: toCsv(
            t.map((row) => ({
              ...row,
              yardName: yn(row.yardId),
              serverTimeIso: new Date(row.serverTime || row.clientTime).toISOString(),
            })),
          ),
        },
        {
          name: 'units.csv',
          csv: toCsv(u.map((row) => ({ ...row, yardName: yn(row.yardId) }))),
        },
        { name: 'yards.csv', csv: toCsv(y as unknown as Record<string, unknown>[]) },
        {
          name: 'stocktakeSessions.csv',
          csv: toCsv(
            s.map((row) => ({
              id: row.id,
              yardId: row.yardId,
              yardName: yn(row.yardId),
              status: row.status,
              expectedCount: row.expectedChassis.length,
              foundCount: Object.keys(row.found).length,
              startedAt: row.startedAt,
              startedByStaffNo: row.startedByStaffNo,
              confirmedAt: row.confirmedAt ?? '',
              confirmedBy: row.confirmedBy ?? '',
              expectedChassis: row.expectedChassis.join('|'),
              foundChassis: Object.keys(row.found).join('|'),
            })),
          ),
        },
      ])
      setMsg('Downloading CSV files for all tables…')
    } finally {
      setBusy(false)
    }
  }

  if (!isFirebaseConfigured) {
    return <p className="panel">Configure Firebase first.</p>
  }

  if (authLoading) return <p className="panel">Loading…</p>

  if (!user) {
    return (
      <div className="panel narrow">
        <h1>Admin login</h1>
        <p className="muted">Use the Firebase Auth email/password admin user.</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            setAuthError(null)
            void login(email, password).catch((err) =>
              setAuthError(err instanceof Error ? err.message : String(err)),
            )
          }}
        >
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {authError && <p className="err">{authError}</p>}
          <button className="primary" type="submit">
            Sign in
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="panel admin">
      <div className="scan-meta">
        <h1>Admin</h1>
        <div className="row">
          <button type="button" className="ghost" onClick={() => void exportCurrent()}>
            Export this table CSV
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void exportAll()}>
            Export all tables CSV
          </button>
          <button type="button" className="ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </div>
      {msg && <p className="muted">{msg}</p>}

      <div className="tabs">
        {(
          [
            ['transactions', 'Transactions'],
            ['units', 'Units'],
            ['yards', 'Yards'],
            ['stocktakes', 'Stock takes'],
            ['settings', 'Settings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'transactions' || tab === 'units') && (
        <input
          className="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      {tab === 'transactions' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Chassis</th>
                <th>Yard</th>
                <th>Type</th>
                <th>Staff</th>
                <th>Source</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.serverTime || t.clientTime).toLocaleString()}</td>
                  <td>
                    <code>{t.chassisNo}</code>
                  </td>
                  <td>{yardName(t.yardId)}</td>
                  <td>{t.type}</td>
                  <td>{t.staffNo}</td>
                  <td>{t.source}</td>
                  <td>{t.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'units' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Chassis</th>
                <th>Yard</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => (
                <tr key={u.chassisNo}>
                  <td>
                    <code>{u.chassisNo}</code>
                  </td>
                  <td>{u.yardId ? yardName(u.yardId) : '—'}</td>
                  <td>{u.updatedAt ? new Date(u.updatedAt).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'yards' && (
        <div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                await createYard(newYard)
                setNewYard('')
                await refresh()
              })()
            }}
          >
            <input
              placeholder="New yard name"
              value={newYard}
              onChange={(e) => setNewYard(e.target.value)}
              required
            />
            <button className="primary" type="submit">
              Add yard
            </button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {yards.map((y) => (
                  <tr key={y.id}>
                    <td>
                      <input
                        defaultValue={y.name}
                        onBlur={(e) => {
                          const name = e.target.value.trim()
                          if (name && name !== y.name) {
                            void updateYard(y.id, { name }).then(refresh)
                          }
                        }}
                      />
                    </td>
                    <td>{y.active ? 'Yes' : 'No'}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void updateYard(y.id, { active: !y.active }).then(refresh)}
                      >
                        {y.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stocktakes' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Yard</th>
                <th>Status</th>
                <th>Expected</th>
                <th>Found</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.startedAt ? new Date(s.startedAt).toLocaleString() : ''}</td>
                  <td>{yardName(s.yardId)}</td>
                  <td>{s.status}</td>
                  <td>{s.expectedChassis.length}</td>
                  <td>{Object.keys(s.found).length}</td>
                  <td>{s.startedByStaffNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <form
          className="stack narrow"
          onSubmit={(e) => {
            e.preventDefault()
            void (async () => {
              if (!/^\d{4,8}$/.test(pin)) {
                setMsg('PIN must be 4–8 digits')
                return
              }
              await setAdminPin(pin)
              setMsg(pinHas ? 'Admin PIN updated' : 'Admin PIN created')
              setPin('')
              setPinHas(true)
            })().catch((err) => setMsg(String(err)))
          }}
        >
          <p>Admin PIN is {pinHas ? 'set' : 'not set yet'}.</p>
          <label>
            Set / change admin PIN (4–8 digits)
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              pattern="\d{4,8}"
              required
            />
          </label>
          <button className="primary" type="submit">
            Save PIN
          </button>
          <button type="button" className="ghost" onClick={() => void refresh()}>
            Refresh data
          </button>
        </form>
      )}
    </div>
  )
}
