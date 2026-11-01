import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage } from './pages/DashboardPage'
import { HomePage } from './pages/HomePage'
import { ScanPage } from './pages/ScanPage'
import { StocktakePage } from './pages/StocktakePage'
import { startSyncLoop } from './services/sync'

export default function App() {
  useEffect(() => startSyncLoop(), [])

  return (
    <BrowserRouter basename="/yard-inventory">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="stocktake" element={<StocktakePage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
