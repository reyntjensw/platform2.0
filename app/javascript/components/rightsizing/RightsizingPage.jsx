import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Monitor, Database, Server, HardDrive, Globe, Trash2, Wrench,
  ArrowDownCircle, ChevronDown, ChevronRight, AlertTriangle,
  Download, BarChart3, List, Layers, Package, CheckCircle,
} from 'lucide-react'
import PageSidebar from '../shared/PageSidebar'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
})

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_SUMMARY = {
  totalResources: 202,
  currentYearlyCost: 124938,
  potentialYearlySavings: 107072,
  optimizedCost: 17866,
  savingsPercent: 85.7,
}

const MOCK_COST_OPTIMIZATION = [
  { label: 'Virtual Machines', amount: 110000 },
  { label: 'SQL Databases', amount: 10000 },
  { label: 'App Service Plans', amount: 5000 },
  { label: 'Managed Disks', amount: 4000 },
  { label: 'VM Scale Sets', amount: 2000 },
  { label: 'Public IPs', amount: 300 },
]

const MOCK_TOP_SAVINGS = [
  { label: 'Virtual Machines', amount: 85000 },
  { label: 'SQL Databases', amount: 10000 },
  { label: 'App Service Plans', amount: 5000 },
  { label: 'Managed Disks', amount: 4000 },
  { label: 'VM Scale Sets', amount: 2000 },
  { label: 'Public IPs', amount: 300 },
]

const MOCK_ORPHANED = {
  count: 149,
  yearlySavings: 8730,
  categories: ['Managed Disks', 'Public IPs', 'Unattached Resources'],
}

const MOCK_RECOMMENDATIONS = [
  { id: 'advisor', label: 'Advisor Recommendations', icon: Wrench, count: 7, type: 'actions', savings: 61610 },
  { id: 'burstable', label: 'Burstable Migration', icon: ArrowDownCircle, count: 10, type: 'resources', savings: 25325 },
  { id: 'downsize-dtu', label: 'Downsize DTU Tier', icon: Database, count: 32, type: 'resources', savings: 10275 },
  { id: 'delete', label: 'Delete Unused', icon: Trash2, count: 149, type: 'resources', savings: 4483 },
]

const MOCK_ACTION_STEPS = [
  { step: 1, label: 'Delete orphaned resources', note: '(low-risk, instant win)' },
  { step: 2, label: 'Apply advisor recommendations', note: '' },
  { step: 3, label: 'Right size virtual machines', note: '' },
  { step: 4, label: 'Optimize SQL databases', note: '' },
]

const SIDEBAR_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { id: 'summary', label: 'Summary', icon: <BarChart3 size={15} /> },
      { id: 'recommendations', label: 'Recommendations', icon: <List size={15} />, count: 24 },
    ],
  },
  {
    label: 'Resource Types',
    items: [
      { id: 'virtual-machines', label: 'Virtual Machines', icon: <Monitor size={15} /> },
      { id: 'vm-scale-sets', label: 'VM Scale Sets', icon: <Layers size={15} /> },
      { id: 'sql-databases', label: 'SQL Databases', icon: <Database size={15} /> },
      { id: 'app-service-plans', label: 'App Service Plans', icon: <Server size={15} /> },
    ],
  },
  {
    label: 'Cleanup',
    items: [
      { id: 'orphaned-resources', label: 'Orphaned Resources', icon: <AlertTriangle size={15} />, count: 149, alert: true },
    ],
  },
]

const TABS = ['Summary', 'Totals', 'Project']

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtEur(n) {
  return `€ ${n.toLocaleString('de-DE')}`
}

function fmtEurShort(n) {
  if (n >= 1000) return `€${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return `€${n}`
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="rs-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`rs-tab${active === tab ? ' active' : ''}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

// ── KPI Cards ──────────────────────────────────────────────────────────────────

function KpiRow({ summary }) {
  const cards = [
    { label: 'Resources', value: String(summary.totalResources), sub: 'across all types', color: '' },
    { label: 'Current Yearly Cost', value: fmtEur(summary.currentYearlyCost), sub: 'before optimization', color: 'green' },
    { label: 'Potential Yearly Savings', value: fmtEur(summary.potentialYearlySavings), sub: `optimized to ${fmtEur(summary.optimizedCost)}/yr`, color: 'green', highlight: true },
    { label: 'Savings %', value: `${summary.savingsPercent}%`, sub: 'efficiency potential', color: 'green' },
  ]

  return (
    <div className="rs-kpi-row">
      {cards.map((c, i) => (
        <div key={i} className={`rs-kpi-card${c.highlight ? ' highlight' : ''}`}>
          <div className="rs-kpi-label">{c.label}</div>
          <div className={`rs-kpi-value ${c.color}`}>{c.value}</div>
          <div className="rs-kpi-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Cost Optimization Potential (with donut) ───────────────────────────────────

function CostOptimizationCard({ items, savingsPercent }) {
  return (
    <div className="rs-card">
      <div className="rs-card-title">Cost Optimization Potential</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          {items.map((item, i) => (
            <div key={i} className="rs-resource-row">
              <span className="rs-resource-name">{item.label}</span>
              <span className="rs-resource-val">{fmtEurShort(item.amount)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 20, marginTop: 8 }}>
          <div className="rs-donut">
            <div className="rs-donut-label">
              <span className="rs-donut-pct">{savingsPercent}%</span>
              <span className="rs-donut-sub">potential<br />savings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Top Savings Opportunities (bar chart) ──────────────────────────────────────

function TopSavingsCard({ items }) {
  const maxVal = Math.max(...items.map(i => i.amount))
  return (
    <div className="rs-card">
      <div className="rs-card-title">Top Savings Opportunities</div>
      {items.map((item, i) => (
        <div key={i} className="rs-opp-row">
          <div className="rs-opp-name">{item.label}</div>
          <div className="rs-opp-bar-wrap">
            <div className="rs-opp-bar" style={{ width: `${(item.amount / maxVal) * 100}%` }} />
          </div>
          <div className="rs-opp-val">{fmtEurShort(item.amount)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Orphaned Resources Alert Banner ────────────────────────────────────────────

function OrphanedAlert({ orphaned, summary, onViewDetails }) {
  return (
    <div className="rs-alert-banner">
      <div className="rs-alert-inner">
        <div className="rs-alert-left">
          <div className="rs-alert-header">
            <AlertTriangle size={16} />
            <span className="rs-alert-title">Orphaned Resources Detected</span>
          </div>
          <div className="rs-alert-count">{orphaned.count} orphaned resources</div>
          <div className="rs-alert-detail">
            {fmtEur(orphaned.yearlySavings)} / year in immediate, low-risk savings available
          </div>
          <div className="rs-alert-tags">
            {orphaned.categories.map((cat, i) => (
              <span key={i} className="rs-alert-tag">
                <CheckCircle size={11} />
                {cat}
              </span>
            ))}
          </div>
          <button className="rs-btn-primary" onClick={onViewDetails}>
            <CheckCircle size={13} />
            View orphaned resources
          </button>
        </div>
        <div className="rs-alert-right">
          <div>
            <div className="rs-alert-savings-big">{fmtEur(summary.potentialYearlySavings)}</div>
            <div className="rs-alert-savings-label">total potential savings · 10 recommendations to action</div>
          </div>
          <div className="rs-alert-metrics">
            <div className="rs-alert-metric">
              <div className="rs-alert-metric-label">Current cost</div>
              <div className="rs-alert-metric-val">{fmtEur(summary.currentYearlyCost)}</div>
            </div>
            <div className="rs-alert-metric">
              <div className="rs-alert-metric-label">Optimized cost</div>
              <div className="rs-alert-metric-val">{fmtEur(summary.optimizedCost)}</div>
            </div>
          </div>
          <div className="rs-alert-efficiency">
            You are only using <strong>{(100 - summary.savingsPercent).toFixed(1)}%</strong> of your current spend efficiently.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail Section (expandable) ────────────────────────────────────────────────

function DetailSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rs-detail-section">
      <button className="rs-detail-trigger" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {Icon && <Icon size={16} className="rs-detail-icon" />}
        <span>{title}</span>
      </button>
      {open && <div className="rs-detail-body">{children}</div>}
    </div>
  )
}

// ── Resource Detail Table ──────────────────────────────────────────────────────

const MOCK_VM_DETAILS = [
  { name: 'web-prod-01', type: 'Standard_D4s_v3', region: 'West Europe', currentCost: 4200, optimizedCost: 2100, savings: 2100, action: 'Downsize' },
  { name: 'web-prod-02', type: 'Standard_D4s_v3', region: 'West Europe', currentCost: 4200, optimizedCost: 2100, savings: 2100, action: 'Downsize' },
  { name: 'api-staging-01', type: 'Standard_D8s_v3', region: 'North Europe', currentCost: 8400, optimizedCost: 4200, savings: 4200, action: 'Downsize' },
  { name: 'batch-worker-03', type: 'Standard_E4s_v3', region: 'West Europe', currentCost: 3600, optimizedCost: 1800, savings: 1800, action: 'Burstable' },
  { name: 'dev-test-vm', type: 'Standard_D2s_v3', region: 'West Europe', currentCost: 2100, optimizedCost: 0, savings: 2100, action: 'Delete' },
]

const MOCK_SQL_DETAILS = [
  { name: 'sqldb-analytics', type: 'S3 (100 DTU)', region: 'West Europe', currentCost: 3600, optimizedCost: 1200, savings: 2400, action: 'Downsize DTU' },
  { name: 'sqldb-reporting', type: 'S2 (50 DTU)', region: 'West Europe', currentCost: 1800, optimizedCost: 900, savings: 900, action: 'Downsize DTU' },
  { name: 'sqldb-legacy', type: 'S4 (200 DTU)', region: 'North Europe', currentCost: 4600, optimizedCost: 1200, savings: 3400, action: 'Downsize DTU' },
]

const MOCK_ORPHANED_DETAILS = [
  { name: 'disk-orphan-001', type: 'Managed Disk', region: 'West Europe', currentCost: 120, optimizedCost: 0, savings: 120, action: 'Delete' },
  { name: 'pip-unused-web', type: 'Public IP', region: 'West Europe', currentCost: 44, optimizedCost: 0, savings: 44, action: 'Delete' },
  { name: 'disk-orphan-002', type: 'Managed Disk', region: 'North Europe', currentCost: 240, optimizedCost: 0, savings: 240, action: 'Delete' },
  { name: 'nic-detached-01', type: 'Network Interface', region: 'West Europe', currentCost: 0, optimizedCost: 0, savings: 0, action: 'Delete' },
]

function ResourceDetailTable({ resources }) {
  return (
    <div className="rs-table-wrap">
      <table className="rs-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Type</th>
            <th>Region</th>
            <th style={{ textAlign: 'right' }}>Current Cost</th>
            <th style={{ textAlign: 'right' }}>Optimized Cost</th>
            <th style={{ textAlign: 'right' }}>Savings</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{r.name}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.type}</td>
              <td>{r.region}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtEur(r.currentCost)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{fmtEur(r.optimizedCost)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>{fmtEur(r.savings)}</td>
              <td>
                <span className="badge badge-dev">{r.action}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Summary View ───────────────────────────────────────────────────────────────

function SummaryView({ onNavigate, customerName }) {
  const [activeTab, setActiveTab] = useState('Summary')

  return (
    <>
      <div className="rs-page-header">
        <div>
          <h2 className="rs-page-title">Rightsizing — Summary</h2>
          <p className="rs-page-sub">Azure · {customerName} · Last updated 2 hours ago</p>
        </div>
        <button className="rs-btn-export">
          <Download size={13} /> Export
        </button>
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <KpiRow summary={MOCK_SUMMARY} />

      <div className="rs-two-col">
        <CostOptimizationCard items={MOCK_COST_OPTIMIZATION} savingsPercent={86} />
        <TopSavingsCard items={MOCK_TOP_SAVINGS} />
      </div>

      <OrphanedAlert
        orphaned={MOCK_ORPHANED}
        summary={MOCK_SUMMARY}
        onViewDetails={() => onNavigate('orphaned-resources')}
      />

      <h3 className="rs-section-title">Resource Details</h3>
      <DetailSection title="Virtual Machines" icon={Monitor} defaultOpen>
        <ResourceDetailTable resources={MOCK_VM_DETAILS} />
      </DetailSection>
      <DetailSection title="SQL Databases" icon={Database}>
        <ResourceDetailTable resources={MOCK_SQL_DETAILS} />
      </DetailSection>
      <DetailSection title="Orphaned Resources" icon={Trash2}>
        <ResourceDetailTable resources={MOCK_ORPHANED_DETAILS} />
      </DetailSection>
    </>
  )
}

// ── Placeholder ────────────────────────────────────────────────────────────────

function PlaceholderView({ title, icon: Icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      {Icon && <Icon size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Detailed view coming soon. Data will be populated once the API is in place.
      </p>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

function RightsizingInner({ customerUuid, customerName, rightsizingApiUrl }) {
  const [activeNav, setActiveNav] = useState('summary')
  const navItem = SIDEBAR_SECTIONS.flatMap(s => s.items).find(i => i.id === activeNav)

  return (
    <div className="rs-layout">
      <PageSidebar
        sections={SIDEBAR_SECTIONS}
        activeId={activeNav}
        onNavigate={setActiveNav}
      />
      <main className="rs-main">
        {activeNav === 'summary' ? (
          <SummaryView onNavigate={setActiveNav} customerName={customerName} />
        ) : (
          <PlaceholderView title={navItem?.label || activeNav} icon={navItem?.icon?.type} />
        )}
      </main>
    </div>
  )
}

export default function RightsizingPage(props) {
  return (
    <QueryClientProvider client={queryClient}>
      <RightsizingInner {...props} />
    </QueryClientProvider>
  )
}
