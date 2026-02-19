import { useRef, useEffect } from 'react'

const CHART_TYPES = [
  { type: 'daily-spend', label: 'Daily Spend', icon: '💰' },
  { type: 'service-breakdown', label: 'Service Breakdown', icon: '📊' },
  { type: 'storage-spend', label: 'Storage Spend', icon: '💾' },
  { type: 'account-distribution', label: 'Account Distribution', icon: '🏦' },
  { type: 'top-services', label: 'Top Services (Table)', icon: '📋' },
  { type: 'monthly-spend-trend', label: 'Monthly Spend (6 Months)', icon: '📅' },
]

export { CHART_TYPES }

export default function AddWidgetModal({ onAdd, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div className="modal-overlay open" style={{ display: 'flex' }}>
      <div ref={ref} className="modal-panel" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">Add Widget</h3>
          <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHART_TYPES.map(ct => (
            <button key={ct.type} onClick={() => { onAdd(ct.type); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'border-color 0.15s' }}>
              <span style={{ fontSize: 20 }}>{ct.icon}</span>{ct.label}
            </button>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
