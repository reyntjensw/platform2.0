import { useState, useRef, useEffect } from 'react'

export default function DashboardSelector({ dashboards, currentId, isLoading, onSelect, onCreate, onRename, onDelete }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setEditingId(null) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const current = dashboards.find(d => d.id === currentId)

  const startEdit = (d, e) => { e.stopPropagation(); setEditingId(d.id); setEditName(d.name) }
  const saveEdit = () => { if (editingId && editName.trim()) onRename(editingId, editName.trim()); setEditingId(null) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        📊 {isLoading ? '…' : <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current?.name || 'Select Dashboard'}</span>}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 6, minWidth: 260, zIndex: 100, boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
          {dashboards.map(d => (
            <div key={d.id} onClick={() => { if (editingId !== d.id) { onSelect(d.id); setOpen(false) } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: d.id === currentId ? 'var(--blue-dim)' : 'transparent', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              {editingId === d.id ? (
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                  onBlur={saveEdit} onClick={e => e.stopPropagation()}
                  className="form-input" style={{ flex: 1, padding: '4px 8px', fontSize: 13 }} />
              ) : (
                <>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {d.is_default && <span className="badge badge-dev" style={{ fontSize: 9 }}>Default</span>}
                  <button onClick={e => startEdit(d, e)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, fontSize: 12 }}>✎</button>
                  {!d.is_default && dashboards.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); onDelete(d.id) }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4, fontSize: 12 }}>✕</button>
                  )}
                </>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
            <button onClick={() => { onCreate(); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: 13, borderRadius: 'var(--radius-sm)' }}>
              + Create New Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
