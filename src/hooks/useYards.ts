import { useEffect, useState } from 'react'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Yard } from '../lib/types'
import { subscribeYards } from '../services/yards'

export function useYards(activeOnly = false) {
  const [yards, setYards] = useState<Yard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      setError('Firebase not configured')
      return
    }
    const unsub = subscribeYards((list) => {
      setYards(activeOnly ? list.filter((y) => y.active) : list)
      setLoading(false)
    })
    return unsub
  }, [activeOnly])

  return { yards, loading, error }
}
