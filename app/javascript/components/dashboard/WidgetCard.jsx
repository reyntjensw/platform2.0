import { useState, useRef, useEffect, useMemo } from 'react'
import { Bar, Pie } from 'react-chartjs-2'
import WidgetAccountFilter from './WidgetAccountFilter'
import WidgetServiceFilter from './WidgetServiceFilter'
import {
  useDailySpend, useServiceSpend, useStorageSpend,
  useMonthlySpendTrend, useAccountSpendDistribution, useTopServices,
  transformDailySpendToChartData, transformServiceSpendToChartData,
  transformMonthlyTrendToChartData, transformAccountSpendToChartData,
} from './hooks'

const DEFAULT_PROVIDER = 'aws'
const PIE_COLORS = ['var(--green)', 'var(--purple)', '#10B981', 'var(--orange)', 'var(--red)', '#EC4899', 'var(--cyan)', '#84CC16']
const PIE_HEX = ['#3b82f6', '#8b5cf6', '#10B981', '#f59e0b', '#ef4444', '#EC4899', '#22d3ee', '#84CC16']

function DropdownMenu({ items, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 4, minWidth: 180, zIndex: 100, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { onSelect(item.action); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: item.danger ? 'var(--red)' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  )
}

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

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#151d2e', borderColor: '#243049', borderWidth: 1, titleColor: '#e8ecf4', bodyColor: '#e8ecf4', padding: 10, cornerRadius: 8 } },
    scales: {
      x: { grid: { color: 'rgba(36,48,73,0.5)', drawBorder: false }, ticks: { color: '#8b99b5', font: { size: 11 } } },
      y: { grid: { color: 'rgba(36,48,73,0.5)', drawBorder: false }, ticks: { color: '#8b99b5', font: { size: 11 } } },
    },
  }
  const pieOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#e8ecf4', boxWidth: 12, padding: 8, font: { size: 10 } } },
      tooltip: { backgroundColor: '#151d2e', borderColor: '#243049', borderWidth: 1, titleColor: '#e8ecf4', bodyColor: '#e8ecf4', padding: 10, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString()}` } },
    },
  }

  const renderChart = () => {
    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Loading…</div>
    if (widget.chart_type === 'daily-spend' && dailyChart) return <Bar data={{ labels: dailyChart.labels, datasets: [{ label: 'Daily Spend', data: dailyChart.datasets[0]?.data || [], backgroundColor: '#3b82f6', borderRadius: 4 }] }} options={barOptions} />
    if (widget.chart_type === 'service-breakdown' && serviceChart) return <Pie data={{ labels: serviceChart.datasets.map(ds => ds.label), datasets: [{ data: serviceChart.datasets.map(ds => ds.data.reduce((a, b) => a + b, 0)), backgroundColor: PIE_HEX, borderWidth: 0 }] }} options={pieOptions} />
    if (widget.chart_type === 'storage-spend' && storageChart) return <Pie data={{ labels: storageChart.datasets.map(ds => ds.label), datasets: [{ data: storageChart.datasets.map(ds => ds.data.reduce((a, b) => a + b, 0)), backgroundColor: PIE_HEX, borderWidth: 0 }] }} options={pieOptions} />
    if (widget.chart_type === 'account-distribution' && acctDistChart) return <Pie data={{ labels: acctDistChart.map(d => d.name), datasets: [{ data: acctDistChart.map(d => d.value), backgroundColor: PIE_HEX, borderWidth: 0 }] }} options={pieOptions} />
    if (widget.chart_type === 'top-services') return renderTopServicesTable()
    if (widget.chart_type === 'monthly-spend-trend' && monthlyChart) {
      const opts = { ...barOptions, scales: { ...barOptions.scales, y: { ...barOptions.scales.y, ticks: { ...barOptions.scales.y.ticks, callback: (v) => `${(Number(v) / 1000).toFixed(0)}k` } } } }
      return <Bar data={{ labels: monthlyChart.map(d => d.name), datasets: [{ label: 'Total Spend', data: monthlyChart.map(d => d.value), backgroundColor: '#3b82f6', borderRadius: 4 }] }} options={opts} />
    }
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>
  }

  const renderTopServicesTable = () => {
    const rows = topSvcData?.services || []
    return (
      <div style={{ height: '100%', overflow: 'auto' }}>
        {topSvcData?.date && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>Data for: {topSvcData.date}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Service</th>
            <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost</th>
            <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Items</th>
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 4px', color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.service}</td>
                <td style={{ padding: '8px 4px', color: 'var(--green)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>${row.total_cost.toLocaleString()}</td>
                <td style={{ padding: '8px 4px', color: 'var(--text-muted)', textAlign: 'right' }}>{row.line_items.toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No data</td></tr>}
          </tbody>
        </table>
      </div>
    )
  }

  const showAccountFilter = !['monthly-spend-trend', 'account-distribution'].includes(widget.chart_type)
  const showServiceFilter = !['monthly-spend-trend', 'storage-spend', 'account-distribution', 'top-services'].includes(widget.chart_type)

  return (
    <div draggable onDragStart={(e) => onDragStart(e, widget.id)} onDragOver={(e) => onDragOver(e, widget.id)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, widget.id)} onDragEnd={onDragEnd}
      style={{
        background: isDragOver ? 'var(--blue-dim)' : 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: isDragOver ? '2px dashed var(--green)' : '1px solid var(--border)',
        padding: 20,
        gridColumn: widget.is_expanded ? '1 / -1' : undefined,
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: isDragging ? 'var(--green)' : 'var(--text-muted)', cursor: 'grab', fontSize: 14 }}>⠿</span>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>{widget.title}</h3>
          {widget.is_saved && <span style={{ color: 'var(--green)', fontSize: 14 }}>★</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showAccountFilter && <WidgetAccountFilter accounts={accounts} selected={accountIds} onChange={handleAccountFilterChange} isLoading={accountsLoading} />}
          {showServiceFilter && <WidgetServiceFilter services={services} selected={serviceIds} onChange={handleServiceFilterChange} isLoading={servicesLoading} />}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 14 }}>⋮</button>
            {menuOpen && <DropdownMenu items={menuItems} onSelect={handleMenuAction} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
      <div style={{ height: widget.is_expanded ? 400 : 250 }}>{renderChart()}</div>
    </div>
  )
}
