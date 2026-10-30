import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useEffect, useId, useRef, useState } from 'react'

interface Props {
  onScan: (text: string) => void
  active?: boolean
}

export function QrScanner({ onScan, active = true }: Props) {
  const reactId = useId().replace(/:/g, '')
  const elementId = `qr-reader-${reactId}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastRef = useRef<string>('')
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const scanner = new Html5Qrcode(elementId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    })
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          const text = decoded.trim()
          if (!text || text === lastRef.current) return
          lastRef.current = text
          onScan(text)
          window.setTimeout(() => {
            lastRef.current = ''
          }, 2000)
        },
        () => undefined,
      )
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Camera unavailable')
        }
      })

    return () => {
      cancelled = true
      scanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          scanner.clear()
        })
      scannerRef.current = null
    }
  }, [active, elementId, onScan])

  return (
    <div className="qr-wrap">
      <div id={elementId} className="qr-viewport" />
      {error && <p className="muted">{error}. Use manual entry below.</p>}
      <form
        className="manual-row"
        onSubmit={(e) => {
          e.preventDefault()
          const v = manual.trim()
          if (!v) return
          onScan(v)
          setManual('')
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Manual chassis no."
          autoCapitalize="characters"
        />
        <button type="submit">Enter</button>
      </form>
    </div>
  )
}
