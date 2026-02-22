import { useState, useRef, useEffect, useMemo } from 'react'
import WidgetAccountFilter from './WidgetAccountFilter'
import WidgetServiceFilter from './WidgetServiceFilter'
import {
  useDailySpend, useServiceSpend, useStorageSpend,
  useMonthlySpendTrend, useAccountSpendDistribution, useTopServices,
  transformDailySpendToChartData, transformServiceSpendToChartData,
  transformMonthlyTrendToChartData, transformAccountSpendToChartData,
} from './hooks'

const DEFAULT_PROVIDER = 'aws'

const CHART_COLORS = [
  '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#fb7185',
  '#34d399', '#f472b6', '#38bdf8', '#facc15', '#c084fc',
]

const MONO = "'JetBrains Mono', 'Fira Code', monospace"

function fmt(val) {
  if (val >= 1000) return `€${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k`
  return `€${Math.round(val)}`
}

function fmtFull(val) {
  return `€ ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDollar(val) {
  if (val >= 1000) return `$${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k`
  return `$${Math.round(val)}`
}

function fmtFullCurrency(val, symbol = '€') {
  return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/* ── Dropdown menu ─────────────────────────────────────────────── */

function DropdownMenu({ items, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 4, minWidth: 160, zIndex: 100, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { onSelect(item.action); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', background: 'none', border: 'none', color: item.danger ? 'var(--red)' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, textAlign: 'left', lineHeight: 1.3 }}>
          <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ── SVG Bar Chart (Daily Spend / Monthly Trend) ───────────────── */

function SvgBarChart({ labels, values, highlightLast, yFormatter, barColor = '#4ade80' }) {
  const [hovered, setHovered] = useState(null)
  const maxVal = Math.max(...values, 1)
  const padTop = 24, padBot = 24, padLeft = 36, padRight = 8
  const w = 600, h = 180
  const plotW = w - padLeft - padRight
  const plotH = h - padTop - padBot
  const barGap = 4
  const barW = Math.max(4, (plotW - barGap * labels.length) / labels.length)
  const gridLines = 5
  const avg = values.reduce((a, b) => a + b, 0) / (values.filter(v => v > 0).length || 1)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}
      onMouseLeave={() => setHovered(null)}>
      {/* grid lines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padTop + (plotH / gridLines) * i
        const val = maxVal - (maxVal / gridLines) * i
        return (
          <g key={i}>
            <line x1={padLeft} y1={y} x2={w - padRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={padLeft - 6} y={y + 3} fontFamily={MONO} fontSize="9" fill="#64748b" textAnchor="end">
              {yFormatter ? yFormatter(val) : fmt(val)}
            </text>
          </g>
        )
      })}
      {/* bars */}
      {values.map((val, i) => {
        const barH = val > 0 ? (val / maxVal) * plotH : 0
        const x = padLeft + i * (barW + barGap)
        const y = padTop + plotH - barH
        const isHigh = val > avg * 1.3
        const isLast = highlightLast && i === values.length - 1
        const isZero = val === 0
        const isHov = hovered === i
        const fill = isZero ? 'rgba(28,34,53,0.5)' : isHigh ? '#fbbf24' : isLast ? barColor : `${barColor}99`
        const shadow = isLast ? `drop-shadow(0 0 6px ${barColor})` : undefined
        return (
          <g key={i} onMouseEnter={() => setHovered(i)} style={{ cursor: val > 0 ? 'pointer' : 'default' }}>
            {/* invisible wider hit area */}
            <rect x={x - 1} y={padTop} width={barW + 2} height={plotH + padBot} fill="transparent" />
            <rect x={x} y={isZero ? padTop + plotH - 4 : y} width={barW} height={isZero ? 4 : barH} rx="2"
              fill={fill} style={{ filter: shadow }} opacity={isHov && !isZero ? 1 : isHigh ? 0.85 : 1} />
            <text x={x + barW / 2} y={h - 4} fontFamily={MONO} fontSize="9" fill={isLast ? barColor : '#64748b'} textAnchor="middle">
              {labels[i]}
            </text>
            {/* tooltip on hover or always for last bar */}
            {((isHov && val > 0) || (isLast && val > 0)) && (
              <g>
                <rect x={x + barW / 2 - 28} y={y - 22} width={56} height={18} rx="4"
                  fill="#111827" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                <text x={x + barW / 2} y={y - 10} fontFamily={MONO} fontSize="9" fontWeight="600"
                  fill={isHov ? '#e2e8f0' : barColor} textAnchor="middle">{fmt(val)}</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ── SVG Bar+Line Combo (Monthly Trend) ────────────────────────── */

function SvgMonthlyTrend({ data }) {
  if (!data || data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.value), 1) * 1.15
  const padTop = 24, padBot = 28, padLeft = 36, padRight = 16
  const w = 520, h = 180
  const plotW = w - padLeft - padRight
  const plotH = h - padTop - padBot
  const barW = 52
  const spacing = plotW / data.length
  const avg = data.reduce((a, d) => a + d.value, 0) / data.length

  const points = data.map((d, i) => {
    const x = padLeft + spacing * i + spacing / 2
    const y = padTop + plotH - (d.value / maxVal) * plotH
    return { x, y, ...d }
  })

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padTop + plotH * (1 - pct)
        return <line key={i} x1={padLeft} y1={y} x2={w - padRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      })}
      {/* y labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padTop + plotH * (1 - pct)
        const val = maxVal * pct
        return <text key={i} x={padLeft - 6} y={y + 3} fontFamily={MONO} fontSize="9" fill="#64748b" textAnchor="end">{`${(val / 1000).toFixed(0)}k`}</text>
      })}
      {/* bars */}
      {points.map((p, i) => {
        const barH = (p.value / maxVal) * plotH
        const isLast = i === points.length - 1
        const isHigh = p.value > avg * 1.15
        return (
          <g key={i}>
            <rect x={p.x - barW / 2} y={padTop + plotH - barH} width={barW} height={barH} rx="3"
              fill={isHigh && !isLast ? 'rgba(251,191,36,0.25)' : isLast ? 'rgba(74,222,128,0.35)' : 'rgba(74,222,128,0.2)'} />
            {isLast && (
              <rect x={p.x - barW / 2} y={padTop + plotH - barH - 20} width={barW} height={20} rx="3"
                fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.4)" strokeWidth="1" strokeDasharray="4 3" />
            )}
          </g>
        )
      })}
      {/* trend line */}
      <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none" stroke="rgba(74,222,128,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* dots + labels */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1
        const isHigh = p.value > avg * 1.15
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={isLast ? 4 : 3}
              fill={isHigh && !isLast ? 'rgba(251,191,36,0.9)' : isLast ? '#4ade80' : 'rgba(74,222,128,0.8)'} />
            <text x={p.x} y={p.y - 8} fontFamily={MONO} fontSize="8.5"
              fill={isHigh && !isLast ? '#fbbf24' : isLast ? 'rgba(74,222,128,0.9)' : '#94a3b8'}
              textAnchor="middle">{fmt(p.value)}</text>
            <text x={p.x} y={h - 4} fontFamily={MONO} fontSize="9"
              fill={isLast ? 'rgba(74,222,128,0.8)' : '#64748b'} textAnchor="middle">
              {p.name}{isLast ? ' ▸' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── SVG Donut Chart ───────────────────────────────────────────── */

function SvgDonut({ slices, centerLabel, centerSub, showSpend, currencySymbol = '€' }) {
  const r = 50, cx = 70, cy = 70, circumference = 2 * Math.PI * r
  const total = slices.reduce((a, s) => a + s.value, 0) || 1
  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, height: '100%' }}>
      <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1c2235" strokeWidth="28" />
        {slices.map((s, i) => {
          const len = (s.value / total) * circumference
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="28"
              strokeDasharray={`${len} ${circumference}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`} opacity="0.75" />
          )
          offset += len
          return el
        })}
        <text x={cx} y={cy - 4} fontFamily={MONO} fontSize="14" fontWeight="600" fill="#e2e8f0" textAnchor="middle">{centerLabel}</text>
        <text x={cx} y={cy + 12} fontFamily={MONO} fontSize="8" fill="#64748b" textAnchor="middle">{centerSub}</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', maxHeight: '100%', paddingRight: 4 }}>
        {slices.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 0', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              {showSpend && <div style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{fmtFullCurrency(s.value, currencySymbol)}</div>}
              <div style={{ width: 50, height: 3, background: '#1c2235', borderRadius: 2, flexShrink: 0 }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length], opacity: 0.6 }} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: '#64748b', flexShrink: 0, minWidth: 30, textAlign: 'right' }}>{pct}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Top Services Table ────────────────────────────────────────── */

function TopServicesTable({ data }) {
  const rows = data?.services || []
  const maxCost = Math.max(...rows.map(r => r.total_cost), 1)
  const thStyle = { textAlign: 'left', padding: '0 0 10px 0', fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.07)' }
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {data?.date && <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>Data for: {data.date}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Service</th>
            <th style={{ ...thStyle, padding: '0 12px 10px 0', width: 80 }}></th>
            <th style={{ ...thStyle, textAlign: 'right' }}>MTD Cost</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <td style={{ padding: '9px 0', fontSize: 12.5, color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  {row.service}
                </div>
              </td>
              <td style={{ padding: '9px 12px 9px 0' }}>
                <div style={{ height: 4, background: '#1c2235', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${(row.total_cost / maxCost) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length], opacity: 0.6 }} />
                </div>
              </td>
              <td style={{ padding: '9px 0', fontFamily: MONO, fontSize: 12, color: '#e2e8f0', textAlign: 'right' }}>{fmtFull(row.total_cost)}</td>
              <td style={{ padding: '9px 0', color: '#64748b', textAlign: 'right', fontSize: 12 }}>{row.line_items?.toLocaleString() ?? '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Main WidgetCard ───────────────────────────────────────────── */

export default function WidgetCard({
  widget, costApi, year, month, accounts, services, accountsLoading, servicesLoading,
  onUpdate, onDelete, isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const accountIds = widget.query_config?.account_ids || []
  const serviceIds = widget.query_config?.service_ids || []
  const effectiveAccountIds = accountIds.length > 0 ? accountIds : accounts
  const canFetch = effectiveAccountIds.length > 0 && !accountsLoading

  const apiRequest = canFetch ? { provider: DEFAULT_PROVIDER, year, month, account_ids: effectiveAccountIds } : null
  const monthlyReq = { months: 6 }
  const acctDistReq = { year, month }
  const topSvcReq = { account_ids: accountIds.length > 0 ? accountIds : undefined, days_ago: 2, limit: 10 }

  const { data: dailyData, isLoading: dailyLoading, refetch: refetchDaily } = useDailySpend(costApi, widget.chart_type === 'daily-spend' ? apiRequest : null)
  const { data: serviceData, isLoading: serviceLoading, refetch: refetchService } = useServiceSpend(costApi, widget.chart_type === 'service-breakdown' ? apiRequest : null)
  const { data: storageData, isLoading: storageLoading, refetch: refetchStorage } = useStorageSpend(costApi, widget.chart_type === 'storage-spend' ? apiRequest : null)
  const { data: monthlyTrendData, isLoading: monthlyTrendLoading, refetch: refetchMonthly } = useMonthlySpendTrend(costApi, widget.chart_type === 'monthly-spend-trend' ? monthlyReq : null)
  const { data: acctDistData, isLoading: acctDistLoading, refetch: refetchAcctDist } = useAccountSpendDistribution(costApi, widget.chart_type === 'account-distribution' ? acctDistReq : null)
  const { data: topSvcData, isLoading: topSvcLoading, refetch: refetchTopSvc } = useTopServices(costApi, widget.chart_type === 'top-services' ? topSvcReq : null)

  const dailyChart = transformDailySpendToChartData(dailyData || null)
  const serviceChart = transformServiceSpendToChartData(serviceData || null)
  const storageChart = transformServiceSpendToChartData(storageData || null)
  const monthlyChart = transformMonthlyTrendToChartData(monthlyTrendData || null)
  const acctDistChart = transformAccountSpendToChartData(acctDistData || null)

  const loadingMap = { 'daily-spend': dailyLoading, 'service-breakdown': serviceLoading, 'storage-spend': storageLoading, 'account-distribution': acctDistLoading, 'top-services': topSvcLoading, 'monthly-spend-trend': monthlyTrendLoading }
  const refetchMap = { 'daily-spend': refetchDaily, 'service-breakdown': refetchService, 'storage-spend': refetchStorage, 'account-distribution': refetchAcctDist, 'top-services': refetchTopSvc, 'monthly-spend-trend': refetchMonthly }
  const isLoading = loadingMap[widget.chart_type] || false
  const refetch = refetchMap[widget.chart_type]

  const menuItems = [
    { label: widget.is_saved ? 'Unsave' : 'Save', icon: widget.is_saved ? '★' : '☆', action: 'toggle-save' },
    { label: widget.is_expanded ? 'Collapse' : 'Expand', icon: widget.is_expanded ? '⊟' : '⊞', action: 'toggle-expand' },
    { label: 'Refresh', icon: '↻', action: 'refresh' },
    { label: 'Delete', icon: '🗑', action: 'delete', danger: true },
  ]

  const handleMenuAction = (action) => {
    if (action === 'toggle-save') onUpdate(widget.id, { is_saved: !widget.is_saved })
    else if (action === 'toggle-expand') onUpdate(widget.id, { is_expanded: !widget.is_expanded })
    else if (action === 'refresh') refetch?.()
    else if (action === 'delete') onDelete(widget.id)
  }

  const handleAccountFilterChange = (ids) => onUpdate(widget.id, { query_config: { ...widget.query_config, account_ids: ids } })
  const handleServiceFilterChange = (ids) => onUpdate(widget.id, { query_config: { ...widget.query_config, service_ids: ids } })

  const renderChart = () => {
    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Loading…</div>

    if (widget.chart_type === 'daily-spend' && dailyChart) {
      const vals = dailyChart.datasets[0]?.data || []
      const avg = vals.reduce((a, b) => a + b, 0) / (vals.filter(v => v > 0).length || 1)
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <SvgBarChart labels={dailyChart.labels} values={vals} highlightLast />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <LegendItem color="rgba(74,222,128,0.6)" label="Normal spend" />
            <LegendItem color="#fbbf24" label="Above average" />
            <LegendItem color="#4ade80" label="Today (projected)" />
            <LegendItem color="rgba(28,34,53,0.5)" label="Weekend / no data" />
            <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: '#64748b' }}>
              Avg: {fmt(avg)}/day
            </div>
          </div>
        </div>
      )
    }

    if (widget.chart_type === 'monthly-spend-trend' && monthlyChart) {
      return <SvgMonthlyTrend data={monthlyChart} />
    }

    if (widget.chart_type === 'service-breakdown' && serviceChart) {
      const slices = serviceChart.datasets.map(ds => ({
        name: ds.label,
        value: ds.data.reduce((a, b) => a + b, 0),
      }))
      const total = slices.reduce((a, s) => a + s.value, 0)
      return <SvgDonut slices={slices} centerLabel={fmt(total)} centerSub="MTD" />
    }

    if (widget.chart_type === 'storage-spend' && storageChart) {
      const slices = storageChart.datasets.map(ds => ({
        name: ds.label,
        value: ds.data.reduce((a, b) => a + b, 0),
      }))
      const total = slices.reduce((a, s) => a + s.value, 0)
      return <SvgDonut slices={slices} centerLabel={fmt(total)} centerSub="Storage" />
    }

    if (widget.chart_type === 'account-distribution' && acctDistChart) {
      const slices = acctDistChart.map(d => ({ name: d.name, value: d.value }))
      const total = slices.reduce((a, s) => a + s.value, 0)
      return <SvgDonut slices={slices} centerLabel={fmtDollar(total)} centerSub="accounts" showSpend currencySymbol="$" />
    }

    if (widget.chart_type === 'top-services') {
      return <TopServicesTable data={topSvcData} />
    }

    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>
  }

  const showAccountFilter = !['monthly-spend-trend', 'account-distribution'].includes(widget.chart_type)
  const showServiceFilter = !['monthly-spend-trend', 'storage-spend', 'account-distribution', 'top-services'].includes(widget.chart_type)

  return (
    <div draggable onDragStart={(e) => onDragStart(e, widget.id)} onDragOver={(e) => onDragOver(e, widget.id)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, widget.id)} onDragEnd={onDragEnd}
      style={{
        background: isDragOver ? 'rgba(74,222,128,0.04)' : 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: isDragOver ? '2px dashed rgba(74,222,128,0.3)' : '1px solid var(--border)',
        overflow: 'hidden',
        gridColumn: widget.is_expanded ? '1 / -1' : undefined,
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: isDragging ? '#4ade80' : 'var(--text-muted)', cursor: 'grab', opacity: 0.4, fontSize: 14 }}>⠿</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{widget.title}</span>
          {widget.is_saved && <span style={{ color: '#4ade80', fontSize: 14 }}>★</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showAccountFilter && <WidgetAccountFilter accounts={accounts} selected={accountIds} onChange={handleAccountFilterChange} isLoading={accountsLoading} />}
          {showServiceFilter && <WidgetServiceFilter services={services} selected={serviceIds} onChange={handleServiceFilterChange} isLoading={servicesLoading} />}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(!menuOpen)}
              style={{ width: 26, height: 26, background: 'var(--bg-input, #1a2235)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>
              ⋮
            </button>
            {menuOpen && <DropdownMenu items={menuItems} onSelect={handleMenuAction} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: 18, height: widget.is_expanded ? 400 : 250 }}>{renderChart()}</div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748b' }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      {label}
    </div>
  )
}
