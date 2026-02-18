import React, { useState, useEffect, useCallback } from "react"
import { csrf } from "./constants"

const API_URL = "/settings/global_tags"

export default function GlobalTagsScreen() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState("")

  const fetchTags = useCallback(async () => {
    const resp = await fetch("/api/global_tags", { headers: { Accept: "application/json" } })
    if (resp.ok) setTags(await resp.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchTags() }, [fetchTags])

  const addTag = async (e) => {
    e.preventDefault()
    if (!newKey.trim() || !newValue.trim()) return
    setSaving(true)
    const resp = await fetch("/api/global_tags", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ key: newKey.trim(), value: newValue.trim(), description: newDesc.trim() })
    })
    if (resp.ok) {
      const tag = await resp.json()
      setTags(prev => [...prev, tag].sort((a, b) => a.key.localeCompare(b.key)))
      setNewKey(""); setNewValue(""); setNewDesc("")
    }
    setSaving(false)
  }

  const toggleTag = async (tag) => {
    const resp = await fetch(`/api/global_tags/${tag.id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() }
    })
    if (resp.ok) {
      const updated = await resp.json()
      setTags(prev => prev.map(t => t.id === updated.id ? updated : t))
    }
  }

  const deleteTag = async (tag) => {
    if (!confirm(`Delete tag '${tag.key}'? This will remove it from all future deployments.`)) return
    const resp = await fetch(`/api/global_tags/${tag.id}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrf() }
    })
    if (resp.ok) setTags(prev => prev.filter(t => t.id !== tag.id))
  }

  const startEdit = (tag) => {
    setEditingId(tag.id)
    setEditValue(tag.value)
  }

  const saveEdit = async (tag) => {
    const resp = await fetch(`/api/global_tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ value: editValue })
    })
    if (resp.ok) {
      const updated = await resp.json()
      setTags(prev => prev.map(t => t.id === updated.id ? updated : t))
    }
    setEditingId(null)
  }

  const enabledTags = tags.filter(t => t.enabled)

  return (
    <div style={{ padding: "32px 48px", maxWidth: 900, margin: "0 auto", color: "var(--text-primary, #e6edf3)" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Global Tags</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted, #8b949e)" }}>
          Tags applied to every deployed resource across all environments.
          {enabledTags.length > 0 && <span style={{ marginLeft: 8 }}>{enabledTags.length} active / {tags.length} total</span>}
        </p>
      </div>

      {/* Add tag form */}
      <div style={{ background: "var(--bg-secondary, #161b22)", border: "1px solid var(--border, #30363d)", borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>Add Tag</h3>
        <form onSubmit={addTag} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 160px" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted, #8b949e)", display: "block", marginBottom: 4 }}>Key *</span>
            <input
              type="text" value={newKey} onChange={e => setNewKey(e.target.value)}
              className="modal-input" placeholder="e.g. managed-by"
              pattern="[a-zA-Z0-9_\-:\/\.]+" title="Alphanumeric, hyphens, underscores, colons, slashes, dots"
              required style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
            />
          </label>
          <label style={{ flex: "1 1 160px" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted, #8b949e)", display: "block", marginBottom: 4 }}>Value *</span>
            <input
              type="text" value={newValue} onChange={e => setNewValue(e.target.value)}
              className="modal-input" placeholder="e.g. factorfifty"
              required style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
            />
          </label>
          <label style={{ flex: "2 1 200px" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted, #8b949e)", display: "block", marginBottom: 4 }}>Description</span>
            <input
              type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              className="modal-input" placeholder="Optional — why this tag exists"
              style={{ fontSize: 12 }}
            />
          </label>
          <button type="submit" className="cv-btn cv-btn-primary cv-btn-sm" disabled={saving || !newKey.trim() || !newValue.trim()}>
            {saving ? "Adding…" : "+ Add Tag"}
          </button>
        </form>
      </div>

      {/* Tags table */}
      <div style={{ background: "var(--bg-secondary, #161b22)", border: "1px solid var(--border, #30363d)", borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #8b949e)", fontSize: 13 }}>Loading…</div>
        ) : tags.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #8b949e)", fontSize: 13 }}>
            No global tags configured yet. Add one above.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, #30363d)", fontSize: 11, color: "var(--text-muted, #8b949e)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "10px 16px", textAlign: "left" }}>Key</th>
                <th style={{ padding: "10px 16px", textAlign: "left" }}>Value</th>
                <th style={{ padding: "10px 16px", textAlign: "left" }}>Description</th>
                <th style={{ padding: "10px 16px", textAlign: "center", width: 70 }}>Status</th>
                <th style={{ padding: "10px 16px", textAlign: "right", width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {tags.map(tag => (
                <tr key={tag.id} style={{ borderBottom: "1px solid var(--border, #30363d)", opacity: tag.enabled ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 16px" }}>
                    <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: "rgba(110,118,129,0.1)", padding: "2px 6px", borderRadius: 4 }}>{tag.key}</code>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {editingId === tag.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          className="modal-input" autoFocus
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: 160 }}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(tag); if (e.key === "Escape") setEditingId(null) }}
                        />
                        <button className="cv-btn cv-btn-primary cv-btn-sm" onClick={() => saveEdit(tag)} style={{ fontSize: 11 }}>Save</button>
                        <button className="cv-btn cv-btn-secondary cv-btn-sm" onClick={() => setEditingId(null)} style={{ fontSize: 11 }}>Cancel</button>
                      </div>
                    ) : (
                      <code
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, cursor: "pointer" }}
                        onClick={() => startEdit(tag)}
                        title="Click to edit"
                      >{tag.value}</code>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 11, color: "var(--text-muted, #8b949e)" }}>{tag.description}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                      background: tag.enabled ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)",
                      color: tag.enabled ? "#3fb950" : "#f85149"
                    }}>{tag.enabled ? "Active" : "Disabled"}</span>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="cv-btn cv-btn-secondary cv-btn-sm" onClick={() => toggleTag(tag)} style={{ fontSize: 11 }}>
                      {tag.enabled ? "Disable" : "Enable"}
                    </button>
                    <button className="cv-btn cv-btn-secondary cv-btn-sm" onClick={() => deleteTag(tag)} style={{ fontSize: 11, color: "#f85149" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview */}
      {enabledTags.length > 0 && (
        <div style={{ background: "var(--bg-secondary, #161b22)", border: "1px solid var(--border, #30363d)", borderRadius: 10, marginTop: 20, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, #30363d)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Preview</h3>
            <p style={{ fontSize: 11, color: "var(--text-muted, #8b949e)", margin: "2px 0 0" }}>These tags will be merged into every resource during deployment.</p>
          </div>
          <pre style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: 16, margin: 0,
            lineHeight: 1.6, overflowX: "auto", color: "var(--text-primary, #e6edf3)"
          }}>
{enabledTags.map(t => `${t.key} = "${t.value}"`).join("\n")}
          </pre>
        </div>
      )}
    </div>
  )
}
