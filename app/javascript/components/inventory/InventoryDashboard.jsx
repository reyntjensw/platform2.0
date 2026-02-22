import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'

/* ── Service metadata ── */
const SERVICE_META = {
  acm:                    { label: 'ACM',             abbr: 'ACM',  color: '#63b3ed' },
  amazonmq:               { label: 'Amazon MQ',       abbr: 'MQ',   color: '#fc814a' },
  efs:                    { label: 'EFS',             abbr: 'EFS',  color: '#68d391' },
  eks:                    { label: 'EKS',             abbr: 'EKS',  color: '#f59e0b' },
  elasticloadbalancingv2: { label: 'Load Balancing',  abbr: 'ELB',  color: '#60a5fa' },
  kms:                    { label: 'KMS',             abbr: 'KMS',  color: '#a78bfa' },
  lambda:                 { label: 'Lambda',          abbr: 'λ',    color: '#f87171' },
  opensearch:             { label: 'OpenSearch',      abbr: 'ES',   color: '#34d399' },
  rds:                    { label: 'RDS',             abbr: 'RDS',  color: '#fbbf24' },
  s3:                     { label: 'S3',              abbr: 'S3',   color: '#fcd34d' },
  secretsmanager:         { label: 'Secrets Manager', abbr: 'SM',   color: '#f87171' },
  sqs:                    { label: 'SQS',             abbr: 'SQS',  color: '#c4b5fd' },
  ec2:                    { label: 'EC2',             abbr: 'EC2',  color: '#f59e0b' },
  cloudfront:             { label: 'CloudFront',      abbr: 'CF',   color: '#60a5fa' },
  route53:                { label: 'Route 53',        abbr: 'R53',  color: '#60a5fa' },
  sns:                    { label: 'SNS',             abbr: 'SNS',  color: '#c4b5fd' },
  dynamodb:               { label: 'DynamoDB',        abbr: 'DDB',  color: '#60a5fa' },
  elasticache:            { label: 'ElastiCache',     abbr: 'EC',   color: '#f87171' },
  wafv2:                  { label: 'WAF',             abbr: 'WAF',  color: '#fbbf24' },
}

function getMeta(cat) {
  return SERVICE_META[cat] || { label: cat, abbr: cat.slice(0, 3).toUpperCase(), color: '#64748b' }
}

function getCsrfToken() {
  const el = document.querySelector('meta[name="csrf-token"]')
  return el ? el.getAttribute('content') : ''
}

function esc(s) { return String(s || '') }

/* ── Derive display name from resource ── */
function deriveName(r) {
  const c = r.configuration || {}
  return c.Name || c.name || c.BrokerName || c.DomainName ||
    c.functionName || c.AddonName || c.loadBalancerName ||
    c.description || c.dBInstanceIdentifier || c.dBSubnetGroupName ||
    r.resource_id.split('/').pop().split(':').pop().split('|').pop()
}

/* ── Flatten API response into flat array ── */
function flattenResources(data) {
  const all = []
  for (const [accountId, categories] of Object.entries(data || {})) {
    for (const [cat, resources] of Object.entries(categories || {})) {
      for (const r of resources) {
        all.push({ ...r, _name: deriveName(r), _account: accountId })
      }
    }
  }
  return all
}

/* ── Config tree renderer ── */
function ConfigValue({ value, depth = 0 }) {
  if (depth > 3) return <span className="inv-cfg-str">"…"</span>
  if (value === null) return <span className="inv-cfg-null">null</span>
  if (typeof value === 'boolean') return <span className={value ? 'inv-cfg-true' : 'inv-cfg-false'}>{String(value)}</span>
  if (typeof value === 'number') return <span className="inv-cfg-num">{value}</span>
  if (typeof value === 'string') {
    const display = value.length > 80 ? value.slice(0, 80) + '…' : value
    return <span className="inv-cfg-str">"{display}"</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="inv-cfg-null">[]</span>
    if (typeof value[0] === 'string') return <span className="inv-cfg-str">[{value.map((v, i) => <React.Fragment key={i}>{i > 0 && ', '}"{v}"</React.Fragment>)}]</span>
    return (
      <div className="inv-cfg-block">
        {value.slice(0, 5).map((v, i) => <div key={i}><ConfigValue value={v} depth={depth + 1} /></div>)}
        {value.length > 5 && <div className="inv-cfg-null">…{value.length - 5} more</div>}
      </div>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return <span className="inv-cfg-null">{'{}'}</span>
    return entries.map(([k, v]) => (
      <div key={k}><span className="inv-cfg-key">{k}</span>: <ConfigValue value={v} depth={depth + 1} /></div>
    ))
  }
  return String(value)
}

/* ── Detail Panel ── */
function DetailPanel({ resource, onClose }) {
  if (!resource) return (
    <div className="inv-detail inv-detail-empty">
      <div className="inv-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <div className="inv-empty-title">Select a resource</div>
      <div className="inv-empty-sub">Click any row to inspect details</div>
    </div>
  )

  const meta = getMeta(resource.category)
  const tags = resource.tags || []
  const cfg = resource.configuration || {}

  return (
    <div className="inv-detail">
      <div className="inv-detail-head">
        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="inv-detail-svc-icon" style={{ background: `${meta.color}1a`, borderColor: `${meta.color}33`, color: meta.color }}>{meta.abbr}</div>
            <div className="inv-detail-name">{resource._name}</div>
          </div>
          <div className="inv-detail-type">{resource.resource_type}</div>
        </div>
        <div className="inv-detail-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>
      <div className="inv-detail-body">
        <div className="inv-detail-section">
          <div className="inv-detail-section-title">Identity</div>
          <DetailRow label="Resource ID" value={resource.resource_id} mono />
          <DetailRow label="Type" value={resource.resource_type} mono />
          <DetailRow label="Service" value={meta.label} />
          <DetailRow label="Region" value={resource.region} />
          <DetailRow label="Account" value={resource._account} mono />
        </div>
        {tags.length > 0 && (
          <div className="inv-detail-section">
            <div className="inv-detail-section-title">Tags ({tags.length})</div>
            {tags.map((t, i) => <DetailRow key={i} label={t.key} value={t.value} mono green />)}
          </div>
        )}
        <div className="inv-detail-section">
          <div className="inv-detail-section-title">Configuration</div>
          <div className="inv-cfg-tree"><ConfigValue value={cfg} /></div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono, green }) {
  return (
    <div className="inv-detail-row">
      <div className="inv-detail-key">{label}</div>
      <div className={`inv-detail-val${mono ? ' mono' : ''}${green ? ' inv-green' : ''}`} style={mono ? { wordBreak: 'break-all', fontSize: '10.5px' } : undefined}>{esc(value)}</div>
    </div>
  )
}

/* ── Sidebar ── */
function Sidebar({ categories, activeCategory, onSelect, searchFilter, onSearchChange, accountId }) {
  const filtered = searchFilter
    ? categories.filter(c => c.label.toLowerCase().includes(searchFilter.toLowerCase()) || c.key.includes(searchFilter.toLowerCase()))
    : categories
  const total = categories.reduce((s, c) => s + c.count, 0)

  return (
    <div className="inv-sidebar">
      <div className="inv-sidebar-head">
        <div className="inv-sidebar-title">Service Categories</div>
        <div className="inv-sidebar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Filter categories…" value={searchFilter} onChange={e => onSearchChange(e.target.value)} />
        </div>
      </div>
      <div className="inv-sidebar-body">
        {(!searchFilter || 'all resources'.includes(searchFilter.toLowerCase())) && (
          <div className={`inv-cat-item${activeCategory === 'all' ? ' active' : ''}`} onClick={() => onSelect('all')}>
            <div className="inv-cat-left">
              <div className="inv-cat-icon" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}>ALL</div>
              <div className="inv-cat-name">All Resources</div>
            </div>
            <div className="inv-cat-count">{total}</div>
          </div>
        )}
        {filtered.map(c => {
          const meta = getMeta(c.key)
          return (
            <div key={c.key} className={`inv-cat-item${activeCategory === c.key ? ' active' : ''}`} onClick={() => onSelect(c.key)}>
              <div className="inv-cat-left">
                <div className="inv-cat-icon" style={{ background: `${meta.color}1a`, color: meta.color }}>{meta.abbr}</div>
                <div className="inv-cat-name">{meta.label}</div>
              </div>
              <div className="inv-cat-count">{c.count}</div>
            </div>
          )
        })}
      </div>
      {accountId && (
        <div className="inv-sidebar-footer">
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Account</div>
          <div className="inv-account-chip">
            <div className="inv-account-dot" />
            <div>
              <div className="inv-account-id">{accountId}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stats Row ── */
function StatsRow({ resources, categories }) {
  const regions = [...new Set(resources.map(r => r.region))].length
  const tagged = resources.filter(r => r.tags && r.tags.length > 0).length
  return (
    <div className="inv-stats-row">
      <StatChip icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>} iconBg="var(--green-dim)" iconBorder="var(--border-active)" value={resources.length} label="Total resources" />
      <StatChip icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--aws)" strokeWidth="1.8"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><path d="M8 6h8M8 18h8M16 3v18"/></svg>} iconBg="var(--aws-dim)" iconBorder="rgba(245,158,11,0.2)" value={categories.length} label="Service categories" />
      <StatChip icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} iconBg="var(--azure-dim)" iconBorder="rgba(96,165,250,0.2)" value={regions} label="Regions" />
      <StatChip icon={<svg viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>} iconBg="var(--amber-dim)" iconBorder="rgba(251,191,36,0.2)" value={tagged} label="Tagged resources" />
    </div>
  )
}

function StatChip({ icon, iconBg, iconBorder, value, label }) {
  return (
    <div className="inv-stat-chip">
      <div className="inv-stat-icon" style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>{icon}</div>
      <div>
        <div className="inv-stat-val">{value}</div>
        <div className="inv-stat-label">{label}</div>
      </div>
    </div>
  )
}

/* ── Resource Table ── */
function ResourceTable({ rows, sortKey, sortDir, onSort, selectedId, onSelect }) {
  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? '↑' : '↓') : ''

  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <thead>
          <tr>
            <th onClick={() => onSort('name')} className={sortKey === 'name' ? 'sorted' : ''}>Resource <span className="inv-sort-icon">{sortIcon('name')}</span></th>
            <th onClick={() => onSort('category')} className={sortKey === 'category' ? 'sorted' : ''}>Service <span className="inv-sort-icon">{sortIcon('category')}</span></th>
            <th onClick={() => onSort('resource_type')} className={sortKey === 'resource_type' ? 'sorted' : ''}>Type <span className="inv-sort-icon">{sortIcon('resource_type')}</span></th>
            <th onClick={() => onSort('region')} className={sortKey === 'region' ? 'sorted' : ''}>Region <span className="inv-sort-icon">{sortIcon('region')}</span></th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const meta = getMeta(r.category)
            const displayId = r.resource_id.length > 50 ? r.resource_id.slice(-40) : r.resource_id
            const shortType = r.resource_type.replace('AWS::', '').replace('::', '::')
            const tags = (r.tags || []).filter(t => t.key !== 'factor-fifty' && t.key !== 'monitor').slice(0, 3)
            const isSelected = r.resource_id === selectedId

            return (
              <tr key={r.resource_id + i} onClick={() => onSelect(r)} className={isSelected ? 'selected' : ''} style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r._name}</div>
                  <div className="mono inv-truncate" style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>{displayId}</div>
                </td>
                <td><span className={`inv-svc-badge inv-svc-${r.category}`}>{meta.label}</span></td>
                <td><span className="mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{shortType}</span></td>
                <td><span className="inv-region-badge">{r.region}</span></td>
                <td>
                  <div className="inv-tag-list">
                    {tags.map((t, j) => (
                      <div key={j} className="inv-tag-chip"><span>{t.key}</span>=<span style={{ color: 'var(--green)' }}>{t.value}</span></div>
                    ))}
                    {tags.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="inv-no-results">
          <div className="inv-no-results-title">No resources found</div>
          <div className="inv-no-results-sub">Try a different search term or category filter</div>
        </div>
      )}
    </div>
  )
}

/* ── Export PDF ── */
function exportInventoryPdf(resources, categories, environmentName, accountId) {
  const bars = [6,8,10,12,14,16,18,20].map(h =>
    `<span style="display:inline-block;width:3px;height:${h}px;background:#2ecc71;border-radius:1px;margin-right:2px;vertical-align:bottom"></span>`
  ).join('')

  const regions = [...new Set(resources.map(r => r.region))].length
  const tagged = resources.filter(r => r.tags && r.tags.length > 0).length

  const statBoxes = [
    { label: 'Total Resources', value: resources.length, color: '#4ade80' },
    { label: 'Services', value: categories.length, color: '#f59e0b' },
    { label: 'Regions', value: regions, color: '#60a5fa' },
    { label: 'Tagged', value: tagged, color: '#fbbf24' },
  ].map(s => `<div style="flex:1;padding:10px 14px;border-right:1px solid #e5e7eb">
    <div style="font-family:monospace;font-size:20px;font-weight:700;color:${s.color}">${s.value}</div>
    <div style="font-size:10px;color:#9ca3af;margin-top:2px">${s.label}</div>
  </div>`).join('')

  const catBadges = categories.map(c => {
    const m = getMeta(c.key)
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:monospace;background:${m.color}1a;color:${m.color};border:1px solid ${m.color}33">${m.abbr} ${c.count}</span>`
  }).join(' ')

  const thStyle = 'padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;white-space:nowrap'
  const tdStyle = 'padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;white-space:nowrap'

  const bodyRows = resources.map(r => {
    const meta = getMeta(r.category)
    const tags = (r.tags || []).filter(t => t.key !== 'factor-fifty' && t.key !== 'monitor').slice(0, 3).map(t => `${t.key}=${t.value}`).join(', ')
    const shortType = r.resource_type.replace('AWS::', '')
    return `<tr>
      <td style="${tdStyle};font-weight:600;color:#1a1a2e">${esc(r._name)}<div style="font-family:monospace;font-size:9px;color:#9ca3af;margin-top:1px">${esc(r.resource_id.length > 50 ? r.resource_id.slice(-40) : r.resource_id)}</div></td>
      <td style="${tdStyle}"><span style="font-family:monospace;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;background:${meta.color}1a;color:${meta.color}">${meta.label}</span></td>
      <td style="${tdStyle};font-family:monospace;font-size:10px;color:#6b7280">${shortType}</td>
      <td style="${tdStyle};font-family:monospace;font-size:10px">${r.region}</td>
      <td style="${tdStyle};font-family:monospace;font-size:10px;color:#6b7280">${tags || '—'}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><title>Resource Inventory — Factor Fifty</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;margin:0;color:#1a1a1a}
      table{border-collapse:collapse;width:100%}
      @media print{.no-print{display:none}}
      @page{margin:14mm 12mm}
    </style>
  </head><body>
    <div style="padding:24px 32px 16px;border-bottom:2px solid #2ecc71;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:flex-end">${bars}</div>
        <span style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1a1a">Factor Fifty</span>
      </div>
      <div style="text-align:right;font-size:11px;color:#888">
        <div>Resource Inventory Report</div>
        <div>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
    <div style="padding:24px 32px">
      <h1 style="font-size:20px;margin:0 0 4px;font-weight:700">Resource Inventory</h1>
      <p style="color:#888;font-size:12px;margin:0 0 16px">${esc(environmentName)} · ${resources.length} resources across ${categories.length} services${accountId ? ` · Account ${accountId}` : ''}</p>

      <div style="display:flex;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden">${statBoxes}</div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">${catBadges}</div>

      <table>
        <thead><tr>
          <th style="${thStyle}">Resource</th>
          <th style="${thStyle}">Service</th>
          <th style="${thStyle}">Type</th>
          <th style="${thStyle}">Region</th>
          <th style="${thStyle}">Tags</th>
        </tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #eee;font-size:10px;color:#aaa;display:flex;justify-content:space-between">
      <span>Generated by Factor Fifty</span><span>Confidential</span>
    </div>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

/* ── Date helpers ── */
function toDateStr(d) { return d.toISOString().slice(0, 10) }
function getYesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d }
function getMinDate() { const d = getYesterday(); d.setMonth(d.getMonth() - 2); return d }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function formatLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const QUICK_PRESETS = [
  { label: 'Yesterday', days: 1, kbd: 'Y' },
  { label: '2 days ago', days: 2, kbd: '2d' },
  { label: '7 days ago', days: 7, kbd: '7d' },
  { label: '30 days ago', days: 30, kbd: '30d' },
]

/* ── Date Picker Dropdown ── */
function DatePickerDropdown({ selectedDate, onChange }) {
  const [open, setOpen] = useState(false)
  const [customDate, setCustomDate] = useState(selectedDate)
  const wrapRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activePreset = QUICK_PRESETS.find(p => toDateStr(daysAgo(p.days)) === selectedDate)

  const pickPreset = (days) => {
    const d = daysAgo(days)
    const str = toDateStr(d)
    if (str >= toDateStr(getMinDate())) {
      onChange(str)
      setCustomDate(str)
    }
    setOpen(false)
  }

  const applyCustom = () => {
    if (customDate >= toDateStr(getMinDate()) && customDate <= toDateStr(getYesterday())) {
      onChange(customDate)
    }
    setOpen(false)
  }

  return (
    <div className="inv-date-wrap" ref={wrapRef}>
      <div className={`inv-date-btn${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        <svg className="inv-cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>{activePreset ? activePreset.label : formatLabel(selectedDate)}</span>
        <svg className="inv-date-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div className={`inv-date-dd${open ? ' open' : ''}`}>
        <div className="inv-dd-label">Quick select</div>
        {QUICK_PRESETS.map(p => {
          const dateStr = toDateStr(daysAgo(p.days))
          const disabled = dateStr < toDateStr(getMinDate())
          return (
            <div
              key={p.days}
              className={`inv-dd-item${selectedDate === dateStr ? ' active' : ''}`}
              onClick={() => !disabled && pickPreset(p.days)}
              style={disabled ? { opacity: 0.35, cursor: 'default' } : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {p.label}
              <span className="inv-dd-kbd">{p.kbd}</span>
            </div>
          )
        })}
        <div className="inv-dd-divider" />
        <div className="inv-dd-label">Custom date</div>
        <div className="inv-dd-custom">
          <input
            type="date"
            value={customDate}
            min={toDateStr(getMinDate())}
            max={toDateStr(getYesterday())}
            onChange={e => setCustomDate(e.target.value)}
          />
        </div>
        <button className="inv-dd-apply" onClick={applyCustom}>Apply</button>
      </div>
    </div>
  )
}

/* ── Main Component ── */
export default function InventoryDashboard({ customerUuid, customerName, environmentName, projectName, environmentUuid, accountId: propAccountId, inventoryApiUrl }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [catSearch, setCatSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState(1)
  const [selectedResource, setSelectedResource] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(getYesterday()))

  const accountId = propAccountId || new URLSearchParams(window.location.search).get('account_id')

  /* Fetch data — re-runs when selectedDate changes */
  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelectedResource(null)
    const [y, m, d] = selectedDate.split('-').map(Number)
    const body = {
      tag_key: 'factor-fifty',
      tag_value: 'true',
      year: y,
      month: m,
      day: d,
      exclude_categories: ['iam'],
      cloud_account_ids: accountId ? [accountId] : [],
    }

    fetch(`${inventoryApiUrl}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify(body),
    })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(data => { setRawData(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [inventoryApiUrl, selectedDate])

  const allResources = useMemo(() => flattenResources(rawData), [rawData])

  const categories = useMemo(() => {
    const counts = {}
    for (const r of allResources) {
      counts[r.category] = (counts[r.category] || 0) + 1
    }
    return Object.entries(counts)
      .map(([key, count]) => ({ key, count, label: getMeta(key).label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allResources])

  const filteredRows = useMemo(() => {
    let rows = allResources
    if (activeCategory !== 'all') rows = rows.filter(r => r.category === activeCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(r => {
        const name = (r._name || '').toLowerCase()
        const id = (r.resource_id || '').toLowerCase()
        const type = (r.resource_type || '').toLowerCase()
        const cat = (r.category || '').toLowerCase()
        const tags = (r.tags || []).map(t => `${t.key}=${t.value}`).join(' ').toLowerCase()
        return name.includes(q) || id.includes(q) || type.includes(q) || cat.includes(q) || tags.includes(q)
      })
    }
    rows = [...rows].sort((a, b) => {
      const av = sortKey === 'name' ? a._name : (a[sortKey] || '')
      const bv = sortKey === 'name' ? b._name : (b[sortKey] || '')
      return String(av).localeCompare(String(bv)) * sortDir
    })
    return rows
  }, [allResources, activeCategory, searchQuery, sortKey, sortDir])

  const handleSort = useCallback((key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }, [sortKey])

  /* Keyboard */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setSelectedResource(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (loading) {
    return (
      <div className="inv-loading">
        <div className="inv-loading-spinner" />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>Loading inventory…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="inv-loading">
        <div style={{ fontSize: 14, color: 'var(--red)', marginBottom: 8 }}>Failed to load inventory</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="inv-shell">
      <Sidebar
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        searchFilter={catSearch}
        onSearchChange={setCatSearch}
        accountId={accountId}
      />
      <div className="inv-main">
        {/* Toolbar */}
        <div className="inv-toolbar">
          <div className="inv-toolbar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search resources — name, ID, type, tag…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <DatePickerDropdown selectedDate={selectedDate} onChange={setSelectedDate} />
          <div className="inv-toolbar-meta">
            Showing <strong>{filteredRows.length}</strong> of <strong>{allResources.length}</strong> resources
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => exportInventoryPdf(filteredRows, categories, environmentName || 'Environment', accountId)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export PDF
          </button>
        </div>

        <StatsRow resources={allResources} categories={categories} />

        <ResourceTable
          rows={filteredRows}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          selectedId={selectedResource?.resource_id}
          onSelect={setSelectedResource}
        />
      </div>

      <div className={`inv-detail-panel${selectedResource ? '' : ' hidden'}`}>
        <DetailPanel resource={selectedResource} onClose={() => setSelectedResource(null)} />
      </div>
    </div>
  )
}
