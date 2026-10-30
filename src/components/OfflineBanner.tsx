import { useEffect, useState } from 'react'
import { flushOfflineQueue, subscribePendingCount } from '../services/sync'

export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const unsub = subscribePendingCount(setPending)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      unsub()
    }
  }, [])

  if (online && pending === 0) return null

  return (
    <div className={`banner ${online ? 'banner-warn' : 'banner-offline'}`}>
      {!online ? (
        <span>Offline — scans will queue locally{pending ? ` (${pending} pending)` : ''}</span>
      ) : (
        <span>
          Syncing {pending} queued scan{pending === 1 ? '' : 's'}…
          <button type="button" className="linkish" onClick={() => void flushOfflineQueue()}>
            Retry now
          </button>
        </span>
      )}
    </div>
  )
}
