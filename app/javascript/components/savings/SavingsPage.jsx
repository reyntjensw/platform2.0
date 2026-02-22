import { useState, useMemo } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Search, Clock, X } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
})

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_SUMMARY = {
  totalSavings: 0,
  mtdSavings: 68.89,
  expiringSavings: 32.40,
  coverage: 55.9,
  missedSavings: 97.31,
  missedSince: 'September 19, 2025',
}

const DEMO_PLANS = [
  {
    id: 'balanced', name: 'Balanced',
    description: 'Moderate savings with maximum flexibility. Best for variable workloads.',
    popular: false, automationEnabled: true,
    monthlySavings: 154.87, annualSavings: 5000,
    monthlyCostWithout: 7710, monthlyCostWith: 6920,
    discountPct: 2.08, netMonthlySavings: 154.87,
    flexibility: { term: '1 Year', upfront: '$0K', breakeven: '$881.92', sliderPct: 35 },
  },
  {
    id: 'recommended', name: 'Recommended',
    description: 'Best balance of savings and commitment. Recommended for most teams.',
    popular: true, automationEnabled: true,
    monthlySavings: 97.31, annualSavings: 3000,
    monthlyCostWithout: 7710, monthlyCostWith: 6920,
    discountPct: 1.26, netMonthlySavings: 97.31,
    flexibility: { term: '1 Year', upfront: '$0K', breakeven: '$50.70', sliderPct: 35 },
  },
  {
    id: 'high-savings', name: 'High Savings',
    description: 'Maximum cost reduction with higher upfront commitment required.',
    popular: false, automationEnabled: true,
    monthlySavings: 172.20, annualSavings: 6000,
    monthlyCostWithout: 7710, monthlyCostWith: 10280,
    discountPct: 2.23, netMonthlySavings: 972.20,
    flexibility: { term: '3 Years', upfront: '$141.00K', breakeven: '$435.65', sliderPct: 80 },
  },
]

// ── Formatting ─────────────────────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n >= 1000) return `$${(n / 1000).toFixed(decimals > 0 ? 2 : 0)}K/mo`
  return `$${n.toFixed(decimals)}`
}

function fmtUsd(n) {
  return `US$ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtShort(n) {
  if (n >= 1000) return `~$${Math.round(n / 1000)}K`
  return `$${n.toFixed(2)}`
}

// ── API helpers ────────────────────────────────────────────────────────────────
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') : ''
}

async function postApi(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

function daysBetween(dateStr, refDate) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const ref = refDate || new Date()
  return Math.round((d - ref) / (1000 * 60 * 60 * 24))
}

function transformCommitmentRows(rows) {
  const now = new Date()
  return rows.map((r) => ({
    type: r.type || '',
    provider: r.provider || '',
    instanceType: r.instance_type || '',
    leasedDisplayName: r.leased_display_name || '',
    offeringInfo: r.offering_info || r.payment_option || '',
    amount: r.instance_count ? parseFloat(r.instance_count) : null,
    monthlyCost: r.monthly_cost ? parseFloat(r.monthly_cost) : null,
    monthlySavings: r.monthly_savings ? parseFloat(r.monthly_savings) : null,
    ageDays: r.reservation_start ? Math.abs(daysBetween(r.reservation_start, now)) : null,
    expiresDays: r.reservation_end ? daysBetween(r.reservation_end, now) : null,
    utilization: r.utilization ? parseFloat(r.utilization) * 100 : 0,
    status: r.status || 'unknown',
  }))
}

function useCommitments(savingsApiUrl, customerUuid, year, month, provider) {
  return useQuery({
    queryKey: ['commitments', customerUuid, year, month, provider],
    queryFn: () => postApi(`${savingsApiUrl}/commitments`, {
      customer_uuid: customerUuid,
      year: String(year),
      month: `${year}-${String(month).padStart(2, '0')}`,
      provider: provider,
    }),
    enabled: !!customerUuid,
    staleTime: 5 * 60_000,
  })
}

function useMetrics(savingsApiUrl, customerUuid, year, month, provider) {
  return useQuery({
    queryKey: ['savings-metrics', customerUuid, year, month, provider],
    queryFn: () => postApi(`${savingsApiUrl}/metrics`, {
      customer_uuid: customerUuid,
      year: String(year),
      month: `${year}-${String(month).padStart(2, '0')}`,
      provider: provider,
    }),
    enabled: !!customerUuid,
    staleTime: 5 * 60_000,
  })
}

function transformMetrics(rows) {
  if (!rows || rows.length === 0) return null
  const r = rows[0]
  return {
    totalSavings: parseFloat(r.total_savings || r.totalSavings || 0),
    mtdSavings: parseFloat(r.mtd_savings || r.mtdSavings || 0),
    expiringSavings: parseFloat(r.expiring_savings || r.expiringSavings || 0),
    coverage: parseFloat(r.coverage || 0) * (parseFloat(r.coverage || 0) <= 1 ? 100 : 1),
    missedSavings: parseFloat(r.missed_savings || r.missedSavings || 0),
    missedSince: r.missed_since || r.missedSince || '',
  }
}

// ── KPI Row ────────────────────────────────────────────────────────────────────
function KpiRow({ summary, isLoading }) {
  if (isLoading) {
    return <div className="sv-kpi-row"><div className="sv-kpi-card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)' }}>Loading summary…</div></div>
  }
  const cards = [
    { label: 'Total Savings', value: fmtUsd(summary.totalSavings), sub: summary.totalSavings === 0 ? 'no active plan' : 'all time', color: '' },
    { label: 'MTD Savings', value: fmtUsd(summary.mtdSavings), sub: 'month to date', color: 'green' },
    { label: 'Expiring Soon', value: fmtUsd(summary.expiringSavings), sub: 'within 30 days', color: 'amber' },
    { label: 'Coverage', value: `${summary.coverage.toFixed(1)}%`, sub: 'of spend committed', color: summary.coverage >= 50 ? 'green' : 'amber' },
  ]
  return (
    <div className="sv-kpi-row">
      {cards.map((c, i) => (
        <div key={i} className="sv-kpi-card">
          <div className="sv-kpi-label">{c.label}</div>
          <div className={`sv-kpi-value ${c.color}`}>{c.value}</div>
          <div className="sv-kpi-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Provider Toggle ────────────────────────────────────────────────────────────
function ProviderToggle({ value, onChange }) {
  return (
    <div className="sv-cloud-filter">
      {['aws', 'azure'].map((p) => (
        <button key={p} className={`sv-cloud-btn${value === p ? ' active' : ''}`} onClick={() => onChange(p)}>
          {p === 'aws' ? 'AWS' : 'Azure'}
        </button>
      ))}
    </div>
  )
}

// ── Plan Search ────────────────────────────────────────────────────────────────
function PlanSearch({ value, onChange, onSearch, isLoading }) {
  return (
    <div className="sv-uuid-search">
      <Search size={13} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        placeholder="Enter plan UUID…" />
    </div>
  )
}

// ── Savings Plan Card ──────────────────────────────────────────────────────────
function SavingsPlanCard({ plan, onViewDetails }) {
  const isRecommended = plan.popular
  return (
    <div className={`sv-plan-card${isRecommended ? ' recommended' : ''}`}>
      <div className="sv-plan-header">
        <div className="sv-plan-header-top">
          <span className="sv-plan-name">{plan.name}</span>
          <div className="sv-plan-badges">
            {plan.popular && <span className="sv-badge blue">Most Popular</span>}
            {plan.automationEnabled && <span className="sv-badge green">Automation On</span>}
          </div>
        </div>
        <div className="sv-plan-desc">{plan.description}</div>
      </div>

      <div className="sv-plan-body">
        <div className="sv-savings-highlight">
          <div>
            <div className="sv-savings-label">Monthly savings</div>
            <div className="sv-savings-value">${plan.monthlySavings.toFixed(2)}</div>
          </div>
          <div>
            <div className="sv-savings-label">Annual savings</div>
            <div className="sv-savings-value secondary">{fmtShort(plan.annualSavings)}</div>
          </div>
        </div>

        <div className="sv-cost-section">
          <div className="sv-cost-row">
            <span className="sv-cost-label">Without plan</span>
            <span className="sv-cost-val">{fmt(plan.monthlyCostWithout)}</span>
          </div>
          <div className="sv-cost-row">
            <span className="sv-cost-label">With plan</span>
            <span className="sv-cost-val highlight">{fmt(plan.monthlyCostWith)}</span>
          </div>
          <div className="sv-cost-row">
            <span className="sv-cost-label"></span>
            <span className="sv-cost-val green">↓ {plan.discountPct.toFixed(2)}% off</span>
          </div>
          <div className="sv-cost-row" style={{ marginTop: 4 }}>
            <span className="sv-cost-label">Monthly savings</span>
            <span className="sv-cost-val">${plan.netMonthlySavings.toFixed(2)}</span>
          </div>
        </div>

        <div className="sv-flex-section">
          <div className="sv-flex-label">Flexibility</div>
          <div className="sv-flex-row">
            <span>Plan term</span>
            <span className="sv-flex-val">{plan.flexibility.term}</span>
          </div>
          <div className="sv-flex-slider">
            <div className="sv-flex-slider-fill" style={{ width: `${plan.flexibility.sliderPct}%` }} />
            <div className="sv-flex-slider-thumb" style={{ left: `${plan.flexibility.sliderPct}%` }} />
          </div>
          <div className="sv-flex-row">
            <span>Upfront spend</span>
            <span className="sv-flex-val">{plan.flexibility.upfront}</span>
          </div>
          <div className="sv-flex-row">
            <span>Break-even</span>
            <span className="sv-flex-val">{plan.flexibility.breakeven}</span>
          </div>
        </div>
      </div>

      <div className="sv-plan-footer">
        <button className={`sv-btn-apply${isRecommended ? ' primary' : ' secondary'}`} onClick={() => onViewDetails(plan)}>View Details</button>
      </div>
    </div>
  )
}

// ── Export helpers ──────────────────────────────────────────────────────────────
const EXPORT_COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'provider', label: 'Provider' },
  { key: 'instanceType', label: 'Instance Type' },
  { key: 'offeringInfo', label: 'Offering Info' },
  { key: 'amount', label: 'Qty' },
  { key: 'monthlyCost', label: 'Monthly Cost' },
  { key: 'monthlySavings', label: 'Monthly Savings' },
  { key: 'ageDays', label: 'Age' },
  { key: 'expiresDays', label: 'Expires' },
  { key: 'utilization', label: 'Utilization' },
  { key: 'status', label: 'Status' },
]

function exportCsv(rows) {
  const header = EXPORT_COLUMNS.map(c => c.label).join(',')
  const lines = rows.map(row =>
    EXPORT_COLUMNS.map(c => {
      const v = row[c.key]
      if (v == null) return ''
      if (c.key === 'utilization') return Math.round(v)
      if (c.key === 'ageDays' || c.key === 'expiresDays') return Math.abs(v)
      const str = String(v)
      return str.includes(',') ? `"${str}"` : str
    }).join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `commitment-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPdf(rows) {
  const headerCells = EXPORT_COLUMNS.map(c =>
    `<th style="padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;font-size:11px;white-space:nowrap">${c.label}</th>`
  ).join('')
  const bodyRows = rows.map(row => {
    const cells = EXPORT_COLUMNS.map(c => {
      let v = row[c.key]
      if (v == null) v = '—'
      else if (c.key === 'utilization') v = `${Math.round(v)}%`
      else if (c.key === 'ageDays' || c.key === 'expiresDays') v = `${Math.abs(v)}d`
      else if (c.key === 'monthlyCost' || c.key === 'monthlySavings') v = `$${Number(v).toFixed(2)}`
      return `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;white-space:nowrap">${v}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const bars = [6,8,10,12,14,16,18,20].map(h =>
    `<span style="display:inline-block;width:3px;height:${h}px;background:#2ecc71;border-radius:1px;margin-right:2px;vertical-align:bottom"></span>`
  ).join('')

  const html = `<!DOCTYPE html><html><head><title>Commitment Inventory — Factor Fifty</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;margin:0;color:#1a1a1a}table{border-collapse:collapse;width:100%}@media print{.no-print{display:none}}</style>
    </head><body>
    <div style="padding:24px 32px 16px;border-bottom:2px solid #2ecc71;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:flex-end">${bars}</div>
        <span style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1a1a">Factor Fifty</span>
      </div>
      <div style="text-align:right;font-size:11px;color:#888">
        <div>Commitment Inventory Report</div>
        <div>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
    <div style="padding:24px 32px">
      <h1 style="font-size:18px;margin:0 0 4px;font-weight:700">Commitment Inventory</h1>
      <p style="color:#888;font-size:12px;margin:0 0 20px">${rows.length} commitment${rows.length !== 1 ? 's' : ''}</p>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #eee;font-size:10px;color:#aaa;display:flex;justify-content:space-between">
      <span>Generated by Factor Fifty</span><span>Confidential</span>
    </div></body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// ── Commitment Inventory Table ─────────────────────────────────────────────────
function CommitmentInventory({ items, isLoading }) {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('AND')
  const [filterType, setFilterType] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const uniqueTypes = useMemo(() => [...new Set(items.map(i => i.type).filter(Boolean))].sort(), [items])
  const uniqueProviders = useMemo(() => [...new Set(items.map(i => i.provider).filter(Boolean))].sort(), [items])
  const uniqueStatuses = useMemo(() => [...new Set(items.map(i => i.status).filter(Boolean))].sort(), [items])

  const filtered = items.filter((item) => {
    const matchesSearch = !search || [item.type, item.instanceType, item.provider, item.leasedDisplayName]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    const checks = []
    if (filterType) checks.push(item.type === filterType)
    if (filterProvider) checks.push(item.provider === filterProvider)
    if (filterStatus) checks.push(item.status === filterStatus)
    const matchesFilters = checks.length === 0 ? true : filterMode === 'AND' ? checks.every(Boolean) : checks.some(Boolean)
    return matchesSearch && matchesFilters
  })

  const fmtDays = (v) => v != null ? `${Math.abs(v)}d` : '—'
  const fmtUtil = (v) => v != null ? Math.round(v) : 0

  return (
    <div className="sv-table-card">
      <div className="sv-table-header">
        <div className="sv-table-title">Commitment Inventory</div>
        <div className="sv-table-actions">
          <button className="sv-btn-sm" onClick={() => exportCsv(filtered)}>Export CSV</button>
          <button className="sv-btn-sm" onClick={() => exportPdf(filtered)}>Export PDF</button>
        </div>
      </div>

      <div className="sv-table-filters">
        <div className="sv-filter-search">
          <Search size={13} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search commitments..." />
        </div>
        <div className="sv-filter-select">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Type</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="sv-filter-select">
          <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
            <option value="">Provider</option>
            {uniqueProviders.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="sv-filter-select">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Status</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="sv-filter-mode">
          <span className="sv-mode-label">Mode</span>
          <button className={`sv-mode-btn${filterMode === 'AND' ? ' active' : ''}`} onClick={() => setFilterMode('AND')}>AND</button>
          <button className={`sv-mode-btn${filterMode === 'OR' ? ' active' : ''}`} onClick={() => setFilterMode('OR')}>OR</button>
        </div>
      </div>

      <div className="sv-table-wrap">
        <table className="sv-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Provider</th>
              <th>Instance Type</th>
              <th>Offering</th>
              <th>Qty</th>
              <th>Monthly Cost</th>
              <th>Monthly Savings</th>
              <th>Age</th>
              <th>Expires</th>
              <th>Utilization</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading commitments…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No commitments found</td></tr>
            ) : filtered.map((row, i) => {
              const util = fmtUtil(row.utilization)
              const utilClass = util >= 80 ? 'high' : util >= 50 ? 'mid' : 'low'
              const expWarn = row.expiresDays != null && row.expiresDays <= 30 && row.expiresDays > 0
              return (
                <tr key={i}>
                  <td className="sv-td-primary">{row.type}</td>
                  <td className="sv-td-mono sv-td-muted">{row.provider}</td>
                  <td className="sv-td-mono">{row.instanceType || '—'}</td>
                  <td className="sv-td-muted">{row.offeringInfo || '—'}</td>
                  <td className="sv-td-mono" style={{ textAlign: 'center' }}>{row.amount ?? '—'}</td>
                  <td className="sv-td-mono">{row.monthlyCost != null ? <span className="sv-td-green">${row.monthlyCost.toFixed(2)}</span> : '—'}</td>
                  <td className="sv-td-mono">{row.monthlySavings != null && row.monthlySavings > 0 ? <span className="sv-td-green">${row.monthlySavings.toFixed(2)}</span> : '—'}</td>
                  <td className="sv-td-mono sv-td-muted">{fmtDays(row.ageDays)}</td>
                  <td className={`sv-td-mono${expWarn ? ' sv-td-amber' : ' sv-td-muted'}`}>{fmtDays(row.expiresDays)}</td>
                  <td>
                    <div className="sv-util-wrap">
                      <div className="sv-util-bar"><div className={`sv-util-fill ${utilClass}`} style={{ width: `${util}%` }} /></div>
                      <span className={`sv-util-pct ${utilClass}`}>{util}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`sv-status-badge ${row.status === 'unlocked' ? 'unlocked' : 'locked'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="9" height="9"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      {row.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Plan Detail Modal ──────────────────────────────────────────────────────────
function exportPlanPdf(summary, detailed_items) {
  const bars = [6,8,10,12,14,16,18,20].map(h =>
    `<span style="display:inline-block;width:3px;height:${h}px;background:#2ecc71;border-radius:1px;margin-right:2px;vertical-align:bottom"></span>`
  ).join('')
  const thPdf = 'padding:6px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:10px;white-space:nowrap'
  const tdPdf = 'padding:6px 8px;border-bottom:1px solid #eee;font-size:10px;white-space:nowrap'
  const itemRows = (detailed_items || []).map(item => `
    <tr>
      <td style="${tdPdf}"><strong>${item.offer?.display_name || '—'}</strong></td>
      <td style="${tdPdf};font-family:monospace">${item.offer?.instance_type || '—'}</td>
      <td style="${tdPdf}">${item.offer?.region || 'Global'}</td>
      <td style="${tdPdf}">${item.payment_option || '—'}</td>
      <td style="${tdPdf};text-align:right">${item.selected_quantity || item.recommended_quantity || '—'}</td>
      <td style="${tdPdf};text-align:right;font-family:monospace">${item.monthly_cost?.toFixed(2) || '0.00'}</td>
      <td style="${tdPdf};text-align:right;font-family:monospace;color:#16a34a">${item.monthly_savings?.toFixed(2) || '0.00'}</td>
      <td style="${tdPdf};text-align:right;font-family:monospace">${item.total_savings?.toFixed(2) || '0.00'}</td>
      <td style="${tdPdf};text-align:right;font-family:monospace">${((item.discount_rate || 0) * 100).toFixed(1)}%</td>
      <td style="${tdPdf};text-align:right;font-family:monospace">${item.breakeven_hours ? Math.round(item.breakeven_hours) + 'h' : '—'}</td>
    </tr>
  `).join('')
  const html = `<!DOCTYPE html><html><head><title>Commitment Plan — Factor Fifty</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;margin:0;color:#1a1a1a}table{border-collapse:collapse;width:100%}@media print{.no-print{display:none}}</style>
    </head><body>
    <div style="padding:24px 32px 16px;border-bottom:2px solid #2ecc71;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px"><div style="display:flex;align-items:flex-end">${bars}</div>
      <span style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Factor Fifty</span></div>
      <div style="text-align:right;font-size:11px;color:#888"><div>Commitment Plan Report</div>
      <div>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
    </div>
    <div style="padding:24px 32px">
      <h1 style="font-size:18px;margin:0 0 4px;font-weight:700">Commitment Plan Details</h1>
      <p style="color:#888;font-size:12px;margin:0 0 20px">${summary.services?.join(', ') || ''} · ${summary.regions?.join(', ') || ''}</p>
      <table><thead><tr><th style="${thPdf}">Service</th><th style="${thPdf}">Instance</th><th style="${thPdf}">Region</th><th style="${thPdf}">Payment</th><th style="${thPdf}">Qty</th><th style="${thPdf}">Monthly Cost</th><th style="${thPdf}">Monthly Savings</th><th style="${thPdf}">Total Savings</th><th style="${thPdf}">Discount</th><th style="${thPdf}">Break-even</th></tr></thead><tbody>${itemRows}</tbody></table>
    </div></body></html>`
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

function PlanDetailModal({ data, onClose, onApply }) {
  if (!data) return null
  const { summary, detailed_items } = data
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 960 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Commitment Plan Details</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Before Plan</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${summary.total_monthly_before_cost?.toFixed(2) || '0.00'}/mo</div>
            </div>
            <div style={{ background: 'var(--bg-body)', border: '1px solid #4ade80', borderRadius: 'var(--radius)', padding: 16 }}>
              <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>With Plan</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#4ade80' }}>${summary.after_cost_hourly ? (summary.after_cost_hourly * 730).toFixed(2) : '0.00'}/mo</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table className="sv-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Service</th><th>Instance Type</th><th>Region</th><th>Payment</th>
                  <th>Qty</th><th>Monthly Cost</th><th>Monthly Savings</th><th>Total Savings</th><th>Discount</th><th>Break-even</th>
                </tr>
              </thead>
              <tbody>
                {(detailed_items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="sv-td-primary">{item.offer?.display_name || '—'}</td>
                    <td className="sv-td-mono">{item.offer?.instance_type || '—'}</td>
                    <td>{item.offer?.region || 'Global'}</td>
                    <td className="sv-td-muted">{item.payment_option || '—'}</td>
                    <td className="sv-td-mono">{item.selected_quantity || item.recommended_quantity || '—'}</td>
                    <td className="sv-td-mono">${item.monthly_cost?.toFixed(2) || '0.00'}</td>
                    <td className="sv-td-mono sv-td-green">${item.monthly_savings?.toFixed(2) || '0.00'}</td>
                    <td className="sv-td-mono">${item.total_savings?.toFixed(2) || '0.00'}</td>
                    <td className="sv-td-mono sv-td-green">{((item.discount_rate || 0) * 100).toFixed(1)}%</td>
                    <td className="sv-td-mono">{item.breakeven_hours ? `${Math.round(item.breakeven_hours)}h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={() => exportPlanPdf(summary, detailed_items)}>Export PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-green btn-sm" onClick={onApply}>Apply Plan</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function SavingsInner({ customerUuid, customerName, savingsApiUrl }) {
  const [provider, setProvider] = useState('aws')
  const [planSearch, setPlanSearch] = useState('')
  const [planData, setPlanData] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState(null)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const { data: commitmentsData, isLoading: commitmentsLoading } = useCommitments(
    savingsApiUrl, customerUuid, currentYear, currentMonth, provider
  )
  const inventory = useMemo(
    () => commitmentsData?.rows ? transformCommitmentRows(commitmentsData.rows) : [],
    [commitmentsData]
  )

  const { data: metricsData, isLoading: metricsLoading } = useMetrics(
    savingsApiUrl, customerUuid, currentYear, currentMonth, provider
  )
  const summary = useMemo(
    () => transformMetrics(metricsData?.rows) || DEMO_SUMMARY,
    [metricsData]
  )

  const handleApplyPlan = async () => {
    if (!planData?.summary?.plan_uuid && !planSearch.trim()) return
    const uuid = planData?.summary?.plan_uuid || planSearch.trim()
    try {
      const res = await fetch(`${savingsApiUrl}/apply_plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ plan_uuid: uuid }),
      })
      if (!res.ok) throw new Error(`Apply failed (${res.status})`)
      await res.json()
      alert('Plan applied successfully')
      setPlanData(null)
    } catch (e) {
      alert(`Failed to apply plan: ${e.message}`)
    }
  }

  const handlePlanSearch = async () => {
    const uuid = planSearch.trim()
    if (!uuid) return
    setPlanLoading(true)
    setPlanError(null)
    try {
      const res = await fetch(`${savingsApiUrl}/plan/${uuid}`, {
        headers: { 'X-CSRF-Token': getCsrfToken() },
      })
      if (!res.ok) throw new Error(`Plan not found (${res.status})`)
      const data = await res.json()
      setPlanData(data)
    } catch (e) {
      setPlanError(e.message)
      setPlanData(null)
    } finally {
      setPlanLoading(false)
    }
  }

  const plans = DEMO_PLANS

  const handleViewDetails = (plan) => {
    setPlanData({
      summary: {
        plan_uuid: plan.id,
        total_monthly_before_cost: plan.monthlyCostWithout,
        after_cost_hourly: plan.monthlyCostWith / 730,
        services: [],
        regions: [],
      },
      detailed_items: [
        {
          offer: { display_name: plan.name, instance_type: '—', region: 'Global' },
          payment_option: plan.flexibility.upfront === '$0K' ? 'No Upfront' : 'Partial Upfront',
          recommended_quantity: 1,
          monthly_cost: plan.monthlyCostWith,
          monthly_savings: plan.netMonthlySavings,
          total_savings: plan.annualSavings,
          discount_rate: plan.discountPct / 100,
          breakeven_hours: parseFloat(plan.flexibility.breakeven.replace(/[^0-9.]/g, '')) || null,
        },
      ],
    })
  }

  return (
    <div className="sv-page">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Cost Optimization</h1>
          <p className="sv-page-sub">{provider === 'aws' ? 'AWS' : 'Azure'} · {customerName} · Savings plans &amp; commitments</p>
        </div>
        <div className="sv-header-actions">
          <PlanSearch value={planSearch} onChange={setPlanSearch} onSearch={handlePlanSearch} isLoading={planLoading} />
          <button className="sv-btn-sm" onClick={handlePlanSearch} disabled={planLoading}>Search</button>
          <ProviderToggle value={provider} onChange={setProvider} />
        </div>
      </div>

      {planError && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}>
          {planError}
        </div>
      )}

      <KpiRow summary={summary} isLoading={metricsLoading} />

      <div className="sv-section-title">Savings Plans</div>
      <div className="sv-plans-grid">
        {plans.map((plan) => <SavingsPlanCard key={plan.id} plan={plan} onViewDetails={handleViewDetails} />)}
      </div>

      <CommitmentInventory items={inventory} isLoading={commitmentsLoading} />

      {planData && <PlanDetailModal data={planData} onClose={() => setPlanData(null)} onApply={handleApplyPlan} />}
    </div>
  )
}

export default function SavingsPage(props) {
  return (
    <QueryClientProvider client={queryClient}>
      <SavingsInner {...props} />
    </QueryClientProvider>
  )
}
