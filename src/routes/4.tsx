import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

export const Route = createFileRoute('/4')({
  component: BrutalistDashboard,
})

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const RETENTION = { d7: 87.3, d30: 82.1, d90: 78.4 }

const RETENTION_CURVE = Array.from({ length: 30 }, (_, i) => {
  const base = 95
  const decay = 0.55
  return Math.max(
    55,
    base * Math.exp(-decay * (i / 10)) + (Math.random() * 3 - 1.5),
  )
})

const CARD_TYPES = [
  { name: 'Basic', retention: 84.2, count: 156 },
  { name: 'Concept', retention: 79.8, count: 89 },
  { name: 'Cloze', retention: 91.3, count: 203 },
  { name: 'Descriptor', retention: 76.5, count: 42 },
]

const DIFFICULTY = [
  { label: 'Easy', count: 89 },
  { label: 'Medium', count: 145 },
  { label: 'Hard', count: 67 },
  { label: 'V.Hard', count: 23 },
]

const TIME = { avg: '8s', daily: '23m', weekly: '2h 41m', monthly: '11h 22m' }

const HOURLY = [
  2, 1, 0, 0, 0, 1, 4, 12, 28, 35, 31, 22, 18, 15, 20, 26, 34, 38, 30, 24, 18,
  12, 8, 4,
]

const FORECAST = Array.from({ length: 30 }, (_, i) => {
  const base = 14
  const growth = 0.8
  return Math.round(base + growth * i + (Math.random() * 6 - 3))
})

const INTERVALS = [
  { range: '< 1d', count: 34 },
  { range: '1-3d', count: 62 },
  { range: '4-7d', count: 88 },
  { range: '1-2w', count: 105 },
  { range: '2-4w', count: 78 },
  { range: '1-3m', count: 56 },
  { range: '3m+', count: 31 },
]

// ---------------------------------------------------------------------------
// Tiny canvas chart helpers
// ---------------------------------------------------------------------------

function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: Array<unknown> = [],
) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)
    draw(ctx, rect.width, rect.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, ...deps])

  return ref
}

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------

function RetentionCurveChart() {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 20, right: 10, bottom: 28, left: 36 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom
    const data = RETENTION_CURVE
    const minY = 50
    const maxY = 100

    // Grid lines
    ctx.strokeStyle = '#d4d4d4'
    ctx.lineWidth = 0.5
    for (let y = 50; y <= 100; y += 10) {
      const py = pad.top + ch - ((y - minY) / (maxY - minY)) * ch
      ctx.beginPath()
      ctx.moveTo(pad.left, py)
      ctx.lineTo(w - pad.right, py)
      ctx.stroke()
    }

    // Axis labels
    ctx.fillStyle = '#000'
    ctx.font = '9px Helvetica Neue, Arial, sans-serif'
    ctx.textAlign = 'right'
    for (let y = 50; y <= 100; y += 10) {
      const py = pad.top + ch - ((y - minY) / (maxY - minY)) * ch
      ctx.fillText(`${y}%`, pad.left - 6, py + 3)
    }
    ctx.textAlign = 'center'
    for (let x = 0; x < 30; x += 5) {
      const px = pad.left + (x / 29) * cw
      ctx.fillText(`${x + 1}`, px, h - pad.bottom + 14)
    }

    // Axes
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top)
    ctx.lineTo(pad.left, h - pad.bottom)
    ctx.lineTo(w - pad.right, h - pad.bottom)
    ctx.stroke()

    // Line
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    data.forEach((v, i) => {
      const px = pad.left + (i / (data.length - 1)) * cw
      const py = pad.top + ch - ((v - minY) / (maxY - minY)) * ch
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // Dots
    data.forEach((v, i) => {
      const px = pad.left + (i / (data.length - 1)) * cw
      const py = pad.top + ch - ((v - minY) / (maxY - minY)) * ch
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.arc(px, py, 2, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  const ref = useCanvas(draw)
  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '240px', display: 'block' }}
    />
  )
}

function BarChart({
  data,
  labelKey,
  valueKey,
  maxOverride,
  accentIndex,
}: {
  data: Array<Record<string, unknown>>
  labelKey: string
  valueKey: string
  maxOverride?: number
  accentIndex?: number
}) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 10, bottom: 28, left: 10 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom
    const values = data.map((d) => d[valueKey] as number)
    const max = maxOverride ?? Math.max(...values)
    const gap = 4
    const barW = (cw - gap * (data.length - 1)) / data.length

    // Axis
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(pad.left, h - pad.bottom)
    ctx.lineTo(w - pad.right, h - pad.bottom)
    ctx.stroke()

    data.forEach((d, i) => {
      const v = d[valueKey] as number
      const barH = (v / max) * ch
      const x = pad.left + i * (barW + gap)
      const y = pad.top + ch - barH

      ctx.fillStyle = i === accentIndex ? '#e63946' : '#000'
      ctx.fillRect(x, y, barW, barH)

      // Label
      ctx.fillStyle = '#000'
      ctx.font = '9px Helvetica Neue, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(d[labelKey]), x + barW / 2, h - pad.bottom + 14)

      // Value on top
      ctx.font = '9px Helvetica Neue, Arial, sans-serif'
      ctx.fillText(String(v), x + barW / 2, y - 4)
    })
  }

  const ref = useCanvas(draw, [data])
  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '200px', display: 'block' }}
    />
  )
}

function HourlyChart() {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 10, bottom: 28, left: 10 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom
    const max = Math.max(...HOURLY)
    const gap = 2
    const barW = (cw - gap * 23) / 24

    // Axis
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(pad.left, h - pad.bottom)
    ctx.lineTo(w - pad.right, h - pad.bottom)
    ctx.stroke()

    HOURLY.forEach((v, i) => {
      const barH = (v / max) * ch
      const x = pad.left + i * (barW + gap)
      const y = pad.top + ch - barH

      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, barW, barH)

      if (i % 4 === 0) {
        ctx.fillStyle = '#000'
        ctx.font = '8px Helvetica Neue, Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${i}h`, x + barW / 2, h - pad.bottom + 14)
      }
    })
  }

  const ref = useCanvas(draw)
  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '180px', display: 'block' }}
    />
  )
}

function ForecastChart() {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 20, right: 10, bottom: 28, left: 36 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom
    const data = FORECAST
    const maxY = Math.max(...data) + 5

    // Grid
    ctx.strokeStyle = '#d4d4d4'
    ctx.lineWidth = 0.5
    const steps = 5
    for (let i = 0; i <= steps; i++) {
      const v = Math.round((maxY / steps) * i)
      const py = pad.top + ch - (v / maxY) * ch
      ctx.beginPath()
      ctx.moveTo(pad.left, py)
      ctx.lineTo(w - pad.right, py)
      ctx.stroke()

      ctx.fillStyle = '#000'
      ctx.font = '9px Helvetica Neue, Arial, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${v}`, pad.left - 6, py + 3)
    }

    // Axes
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top)
    ctx.lineTo(pad.left, h - pad.bottom)
    ctx.lineTo(w - pad.right, h - pad.bottom)
    ctx.stroke()

    // X labels
    ctx.textAlign = 'center'
    for (let x = 0; x < 30; x += 7) {
      const px = pad.left + (x / 29) * cw
      ctx.fillText(`D${x + 1}`, px, h - pad.bottom + 14)
    }

    // Bars
    const gap = 2
    const barW = (cw - gap * (data.length - 1)) / data.length
    data.forEach((v, i) => {
      const barH = (v / maxY) * ch
      const x = pad.left + i * (barW + gap)
      const y = pad.top + ch - barH
      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, barW, barH)
    })
  }

  const ref = useCanvas(draw)
  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '200px', display: 'block' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Styles (CSS-in-JS objects)
// ---------------------------------------------------------------------------

const S = {
  page: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: '#ffffff',
    color: '#000000',
    minHeight: '100vh',
    padding: '60px 120px 120px',
    boxSizing: 'border-box' as const,
  },
  backLink: {
    fontSize: '0.625rem',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    color: '#000',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: '48px',
  },
  headerWrap: {
    marginBottom: '64px',
  },
  headerLine: {
    fontSize: '4.5rem',
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontWeight: 400,
    lineHeight: 0.95,
    margin: 0,
    padding: 0,
  },
  redRule: {
    width: '80px',
    height: '3px',
    background: '#e63946',
    marginTop: '20px',
  },
  dateLabel: {
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    marginTop: '16px',
    color: '#888',
  },
  thickRule: {
    border: 'none',
    borderTop: '3px solid #000',
    margin: '0 0 0 0',
  },
  sectionLabel: {
    fontSize: '0.625rem',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    marginBottom: '24px',
    marginTop: '0',
    fontWeight: 500,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0',
  },
  metricCell: {
    paddingRight: '32px',
    paddingBottom: '40px',
  },
  metricNumber: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: '7rem',
    lineHeight: 0.9,
    margin: 0,
    fontWeight: 400,
  },
  metricLabel: {
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    marginTop: '8px',
    color: '#555',
    fontWeight: 500,
  },
  verticalDivider: {
    borderLeft: '1px solid #d4d4d4',
    paddingLeft: '32px',
  },
  section: {
    marginBottom: '0',
    paddingTop: '40px',
    paddingBottom: '48px',
  },
  cardTypeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '10px 0',
    borderBottom: '1px solid #e0e0e0',
  },
  cardTypeName: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    fontWeight: 500,
  },
  cardTypeRetention: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: '2rem',
    fontWeight: 400,
  },
  cardTypeCount: {
    fontSize: '0.625rem',
    color: '#888',
    letterSpacing: '0.1em',
  },
  timeNumber: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: '3rem',
    lineHeight: 1,
    fontWeight: 400,
    margin: 0,
  },
  timeLabel: {
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    color: '#555',
    marginTop: '4px',
  },
} as const

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function BrutalistDashboard() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

        @media (max-width: 900px) {
          .brutalist-page {
            padding: 32px 24px 80px !important;
          }
          .brutalist-grid3 {
            grid-template-columns: 1fr !important;
          }
          .brutalist-grid2 {
            grid-template-columns: 1fr !important;
          }
          .brutalist-hero-number {
            font-size: 4.5rem !important;
          }
          .brutalist-header-line {
            font-size: 3rem !important;
          }
          .brutalist-vdiv {
            border-left: none !important;
            padding-left: 0 !important;
          }
        }
      `}</style>

      <div className="brutalist-page" style={S.page}>
        {/* Back link */}
        <Link to="/" style={S.backLink}>
          &larr;&ensp;Back
        </Link>

        {/* Header */}
        <div style={S.headerWrap}>
          <h1 className="brutalist-header-line" style={S.headerLine}>
            Learning
          </h1>
          <h1 className="brutalist-header-line" style={S.headerLine}>
            Analytics
          </h1>
          <div style={S.redRule} />
          <p style={S.dateLabel}>
            Dashboard&ensp;&middot;&ensp;
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* ================================================================ */}
        {/* SECTION: Retention Overview */}
        {/* ================================================================ */}
        <hr style={S.thickRule} />
        <div style={S.section}>
          <p style={S.sectionLabel}>Retention Overview</p>
          <div className="brutalist-grid3" style={S.grid3}>
            {/* 7-day */}
            <div style={S.metricCell}>
              <p
                className="brutalist-hero-number"
                style={{
                  ...S.metricNumber,
                  color: '#e63946',
                  fontSize: '8rem',
                }}
              >
                {RETENTION.d7}
                <span style={{ fontSize: '3rem' }}>%</span>
              </p>
              <p style={S.metricLabel}>7-Day Retention</p>
            </div>

            {/* 30-day */}
            <div
              className="brutalist-vdiv"
              style={{ ...S.metricCell, ...S.verticalDivider }}
            >
              <p className="brutalist-hero-number" style={S.metricNumber}>
                {RETENTION.d30}
                <span style={{ fontSize: '2.5rem' }}>%</span>
              </p>
              <p style={S.metricLabel}>30-Day Retention</p>
            </div>

            {/* 90-day */}
            <div
              className="brutalist-vdiv"
              style={{ ...S.metricCell, ...S.verticalDivider }}
            >
              <p className="brutalist-hero-number" style={S.metricNumber}>
                {RETENTION.d90}
                <span style={{ fontSize: '2.5rem' }}>%</span>
              </p>
              <p style={S.metricLabel}>90-Day Retention</p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION: Retention Curve + Card Types */}
        {/* ================================================================ */}
        <hr style={S.thickRule} />
        <div style={S.section}>
          <div className="brutalist-grid2" style={S.grid2}>
            {/* Retention Curve */}
            <div style={{ paddingRight: '40px' }}>
              <p style={S.sectionLabel}>Retention Curve</p>
              <RetentionCurveChart />
              <p
                style={{
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: '#888',
                  marginTop: '8px',
                }}
              >
                Day &rarr;
              </p>
            </div>

            {/* Card Type Breakdown */}
            <div className="brutalist-vdiv" style={{ ...S.verticalDivider }}>
              <p style={S.sectionLabel}>Card Type Breakdown</p>
              {CARD_TYPES.map((ct, i) => (
                <div key={ct.name} style={S.cardTypeRow}>
                  <span style={S.cardTypeName}>{ct.name}</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '16px',
                    }}
                  >
                    <span style={S.cardTypeCount}>{ct.count} cards</span>
                    <span
                      style={{
                        ...S.cardTypeRetention,
                        color: i === 2 ? '#e63946' : '#000',
                      }}
                    >
                      {ct.retention}%
                    </span>
                  </div>
                </div>
              ))}
              <p
                style={{
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: '#888',
                  marginTop: '16px',
                }}
              >
                <span style={{ color: '#e63946' }}>&bull;</span> Cloze cards
                lead retention
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION: Intervals + Difficulty */}
        {/* ================================================================ */}
        <hr style={S.thickRule} />
        <div style={S.section}>
          <div className="brutalist-grid2" style={S.grid2}>
            {/* Intervals */}
            <div style={{ paddingRight: '40px' }}>
              <p style={S.sectionLabel}>Interval Distribution</p>
              <BarChart data={INTERVALS} labelKey="range" valueKey="count" />
            </div>

            {/* Difficulty */}
            <div className="brutalist-vdiv" style={{ ...S.verticalDivider }}>
              <p style={S.sectionLabel}>Difficulty Distribution</p>
              <BarChart data={DIFFICULTY} labelKey="label" valueKey="count" />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION: Time Stats */}
        {/* ================================================================ */}
        <hr style={S.thickRule} />
        <div style={S.section}>
          <p style={S.sectionLabel}>Time Investment</p>
          <div
            className="brutalist-grid3"
            style={{ ...S.grid3, gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            {[
              { value: TIME.avg, label: 'Avg. Per Card' },
              { value: TIME.daily, label: 'Daily Average' },
              { value: TIME.weekly, label: 'Weekly Total' },
              { value: TIME.monthly, label: 'Monthly Total' },
            ].map((t, i) => (
              <div
                key={t.label}
                className={i > 0 ? 'brutalist-vdiv' : ''}
                style={{
                  ...(i > 0 ? S.verticalDivider : {}),
                  marginBottom: '20px',
                }}
              >
                <p style={S.timeNumber}>{t.value}</p>
                <p style={S.timeLabel}>{t.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION: Hourly Activity + Forecast */}
        {/* ================================================================ */}
        <hr style={S.thickRule} />
        <div style={S.section}>
          <div className="brutalist-grid2" style={S.grid2}>
            {/* Hourly */}
            <div style={{ paddingRight: '40px' }}>
              <p style={S.sectionLabel}>Hourly Activity</p>
              <HourlyChart />
              <p
                style={{
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: '#888',
                  marginTop: '8px',
                }}
              >
                Hour of day (24h)
              </p>
            </div>

            {/* Forecast */}
            <div className="brutalist-vdiv" style={{ ...S.verticalDivider }}>
              <p style={S.sectionLabel}>30-Day Review Forecast</p>
              <ForecastChart />
              <p
                style={{
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: '#888',
                  marginTop: '8px',
                }}
              >
                Cards due per day &rarr;
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION: Summary Strip */}
        {/* ================================================================ */}
        <hr style={S.thickRule} />
        <div style={{ paddingTop: '40px', paddingBottom: '24px' }}>
          <div
            className="brutalist-grid3"
            style={{
              ...S.grid3,
              gridTemplateColumns: 'repeat(5, 1fr)',
            }}
          >
            {[
              { v: '490', l: 'Total Cards' },
              { v: '324', l: 'Mature Cards' },
              { v: '87%', l: 'Overall Retention' },
              { v: '1.6', l: 'Avg. Stability' },
              { v: '12', l: 'Day Streak' },
            ].map((item, i) => (
              <div
                key={item.l}
                className={i > 0 ? 'brutalist-vdiv' : ''}
                style={{
                  ...(i > 0 ? S.verticalDivider : {}),
                  textAlign: 'center' as const,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontSize: '2.5rem',
                    fontWeight: 400,
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {item.v}
                </p>
                <p style={{ ...S.metricLabel, marginTop: '6px' }}>{item.l}</p>
              </div>
            ))}
          </div>
        </div>

        <hr
          style={{ border: 'none', borderTop: '3px solid #000', margin: '0' }}
        />

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '20px',
          }}
        >
          <p
            style={{
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              color: '#888',
              margin: 0,
            }}
          >
            Nodeflow Learning Analytics
          </p>
          <p
            style={{
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              color: '#888',
              margin: 0,
            }}
          >
            <span style={{ color: '#e63946' }}>&bull;</span>&ensp;Generated{' '}
            {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>
    </>
  )
}
