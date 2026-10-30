import { Link, NavLink, Outlet } from 'react-router-dom'
import { OfflineBanner } from './OfflineBanner'
import { isFirebaseConfigured } from '../lib/firebase'

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Yard Inventory
        </Link>
        <nav>
          <NavLink to="/scan">Scan</NavLink>
          <NavLink to="/stocktake">Stock take</NavLink>
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/dashboard">TV</NavLink>
        </nav>
      </header>
      <OfflineBanner />
      {!isFirebaseConfigured && (
        <div className="banner banner-offline">
          Firebase not configured — copy <code>.env.example</code> to <code>.env</code> and add
          project keys.
        </div>
      )}
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
