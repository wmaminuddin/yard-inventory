export type GaugeTone = 'ok' | 'warn' | 'over' | 'none'

interface Props {
  /** 0–100+ display percent; ring fill capped at 100 */
  percent: number | null
  primary: string
  secondary?: string
  size?: number
  stroke?: number
  tone?: GaugeTone
}

const TONE_STROKE: Record<GaugeTone, string> = {
  ok: '#3dd6c6',
  warn: '#f0b429',
  over: '#ff6b7a',
  none: '#3a4a66',
}

export function capacityTone(count: number, max: number): GaugeTone {
  if (max <= 0) return 'none'
  if (count > max) return 'over'
  if (count / max >= 0.9) return 'warn'
  return 'ok'
}

export function RingGauge({
  percent,
  primary,
  secondary,
  size = 200,
  stroke = 16,
  tone = 'ok',
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const hasPct = percent != null && Number.isFinite(percent)
  const fillPct = hasPct ? Math.min(100, Math.max(0, percent)) : 0
  const dash = (fillPct / 100) * c
  const color = TONE_STROKE[tone]
  const cx = size / 2
  const cy = size / 2
  const primarySize = size * 0.22
  const secondarySize = size * 0.11

  return (
    <svg
      className="ring-gauge"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#1e2a3f"
        strokeWidth={stroke}
      />
      {hasPct && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      <text
        x={cx}
        y={secondary ? cy - size * 0.02 : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e8eefc"
        fontSize={primarySize}
        fontWeight={800}
        fontFamily="inherit"
      >
        {primary}
      </text>
      {secondary && (
        <text
          x={cx}
          y={cy + primarySize * 0.65}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={tone === 'none' ? '#93a0b8' : color}
          fontSize={secondarySize}
          fontWeight={700}
          fontFamily="inherit"
        >
          {secondary}
        </text>
      )}
    </svg>
  )
}
