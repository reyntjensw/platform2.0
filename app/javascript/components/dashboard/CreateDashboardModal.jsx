import { useState, useRef, useEffect } from 'react'

export default function CreateDashboardModal({ onConfirm, onClose }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="modal-overlay open" style={{ display: 'flex' }}>
      <div ref={panelRef} className="modal-panel" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">Create Dashboard</h3>
          <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="dashboard-name">Dashboard Name *</label>
              <input
                ref={inputRef}
                id="dashboard-name"
                type="text"
                className="form-input"
                placeholder="e.g. Production Costs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green" disabled={!name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
