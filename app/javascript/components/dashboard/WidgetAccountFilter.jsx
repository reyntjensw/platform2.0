import { useState, useRef, useEffect } from 'react'

export default function WidgetAccountFilter({ accounts, selected, onChange, isLoading }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 10px', borderColor: selected.length > 0 ? 'var(--green)' : undefined, color: selected.length > 0 ? 'var(--green)' : undefined }}>
        ⏷ {selected.length > 0 ? `${selected.length} accounts` : 'All accounts'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 8, minWidth: 200, zIndex: 50, boxShadow: 'var(--shadow)', border: '1px solid var(--border)', maxHeight: 250, overflowY: 'auto' }}>
          {isLoading ? <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: 8 }}>Loading…</div>
            : accounts.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: 8 }}>No accounts</div>
            : <>
                {accounts.map(acc => (
                  <label key={acc} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    <input type="checkbox" checked={selected.includes(acc)} onChange={() => toggle(acc)} />
                    {acc}
                  </label>
                ))}
                {selected.length > 0 && (
                  <button onClick={() => onChange([])} style={{ width: '100%', padding: '5px 8px', background: 'none', border: 'none', color: 'var(--green)', fontSize: 10.5, cursor: 'pointer', borderTop: '1px solid var(--border)', marginTop: 4 }}>Clear all</button>
                )}
              </>
          }
        </div>
      )}
    </div>
  )
}
