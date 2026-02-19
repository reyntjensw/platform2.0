import React, { useState, useEffect, useCallback } from "react"
import { csrf } from "./constants"

export default function GlobalTagsScreen({ environmentId, environment, project, customer }) {
  const [levels, setLevels] = useState([])
  const [mergedTags, setMergedTags] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeLevel, setActiveLevel] = useState(null) // { type, id, label }
  const [tags, setTags] = useState([])
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState("")
  const [view, setView] = useState("levels") // "levels" or "merged"

  const fetchByLevel = useCallback(async () => {
    if (!environmentId) return
    const resp = await fetch(`/api/global_tags/by_level?environment_id=${environmentId}`, {
      headers: { Accept: "application/json" }
    })
    if (resp.ok) setLevels(await resp.json())
  }, [environmentId])

  const fetchMerged = useCallback(async () => {
    if (!environmentId) return
    const resp = await fetch(`/api/global_tags/merged?environment_id=${environmentId}`, {
      headers: { Accept: "application/json" }
    })
    if (resp.ok) setMergedTags(await resp.json())
  }, [environmentId])

  const fetchScopedTags = useCallback(async (scopeType, scopeId) => {
    const params = scopeType && scopeId
      ? `?scope_type=${scopeType}&scope_id=${scopeId}`
      : ""
    const resp = await fetch(`/api/global_tags${params}`, {
      headers: { Accept: "application/json" }
    })
    if (resp.ok) setTags(await resp.json())
  }, [])

  useEffect(() => {
    Promise.all([fetchByLevel(), fetchMerged()]).then(() => setLoading(false))
  }, [fetchByLevel, fetchMerged])

  const selectLevel = (level) => {
    setActiveLevel(level)
    fetchScopedTags(level.taggable_type, level.taggable_id)
  }

  const backToLevels = () => {
    setActiveLevel(null)
    setTags([])
    fetchByLevel()
    fetchMerged()
  }

  const addTag = async (e) => {
    e.preventDefault()
    if (!newKey.trim() || !newValue.trim()) return
    setSaving(true)
    const body = { key: newKey.trim(), value: newValue.trim(), description: newDesc.trim() }
    if (activeLevel?.taggable_type) {
      body.scope_type = activeLevel.taggable_type
      body.scope_id = activeLevel.taggable_id
    }
    const params = activeLevel?.taggable_type
      ? `?scope_type=${activeLevel.taggable_type}&scope_id=${activeLevel.taggable_id}`
      : ""
    const resp = await fetch(`/api/global_tags${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify(body)
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
    if (!confirm(`Delete tag '${tag.key}'?`)) return
    const resp = await fetch(`/api/global_tags/${tag.id}`, {
      method: "DELETE", headers: { "X-CSRF-Token": csrf() }
    })
    if (resp.ok) setTags(prev => prev.filter(t => t.id !== tag.id))
  }

  const startEdit = (tag) => { setEditingId(tag.id); setEditValue(tag.value) }

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

  const mergedEntries = Object.entries(mergedTags).sort(([a], [b]) => a.localeCompare(b))

  if (loading) {
    return (
      <div style={{ padding: "60px 48px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Loading tags…
      </div>
    )
  }

  // Detail view: editing tags at a specific level
  if (activeLevel) {
    return (
      <div style={{ padding: "32px 48px", maxWidth: 900, margin: "0 auto", color: "var(--text-primary)" }}>
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={backToLevels} style={{ marginBottom: 12 }}>
            ← Back to overview
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{activeLevel.level}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {tags.length} tag{tags.length !== 1 ? "s" : ""} at this level
          </p>
        </div>

        {/* Add tag form */}
        <div style={panelStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>Add Tag</h3>
          <form onSubmit={addTag} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 160px" }}>
              <span style={labelStyle}>Key *</span>
              <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)}
                className="form-input" placeholder="e.g. managed-by" required
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
            </label>
            <label style={{ flex: "1 1 160px" }}>
              <span style={labelStyle}>Value *</span>
              <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)}
                className="form-input" placeholder="e.g. factorfifty" required
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
            </label>
            <label style={{ flex: "2 1 200px" }}>
              <span style={labelStyle}>Description</span>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                className="form-input" placeholder="Optional" style={{ fontSize: 12 }} />
            </label>
            <button type="submit" className="btn btn-green btn-sm"
              disabled={saving || !newKey.trim() || !newValue.trim()}>
              {saving ? "Adding…" : "+ Add"}
            </button>
          </form>
        </div>

        {/* Tags table */}
        <div style={{ ...panelStyle, padding: 0, marginTop: 16, overflow: "hidden" }}>
          {tags.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No tags at this level yet.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={theadRowStyle}>
                  <th style={thStyle}>Key</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, textAlign: "center", width: 70 }}>Status</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {tags.map(tag => (
                  <tr key={tag.id} style={{ borderBottom: "1px solid var(--border)", opacity: tag.enabled ? 1 : 0.5 }}>
                    <td style={tdStyle}>
                      <code style={codeStyle}>{tag.key}</code>
                    </td>
                    <td style={tdStyle}>
                      {editingId === tag.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                            className="form-input" autoFocus
                            style={{ fontFamily: "var(--font-mono)", fontSize: 12, width: 160 }}
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(tag); if (e.key === "Escape") setEditingId(null) }} />
                          <button className="btn btn-green btn-sm" onClick={() => saveEdit(tag)} style={{ fontSize: 11 }}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} style={{ fontSize: 11 }}>Cancel</button>
                        </div>
                      ) : (
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer" }}
                          onClick={() => startEdit(tag)} title="Click to edit">{tag.value}</code>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-muted)" }}>{tag.description}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={tag.enabled ? badgeActive : badgeDisabled}>
                        {tag.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleTag(tag)} style={{ fontSize: 11 }}>
                        {tag.enabled ? "Disable" : "Enable"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteTag(tag)} style={{ fontSize: 11 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // Overview: show all levels + merged preview
  return (
    <div style={{ padding: "32px 48px", maxWidth: 900, margin: "0 auto", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Global Tags</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Tags for {environment?.name || "this environment"} — merged from Platform → Reseller → Customer → Project → Environment.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={`btn btn-sm ${view === "levels" ? "btn-green" : "btn-ghost"}`}
            onClick={() => setView("levels")}>By Level</button>
          <button className={`btn btn-sm ${view === "merged" ? "btn-green" : "btn-ghost"}`}
            onClick={() => setView("merged")}>Merged Preview</button>
        </div>
      </div>

      {view === "levels" ? (
        /* Level cards */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {levels.map((level, i) => (
            <div key={i} style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: level.tags.length > 0 ? 12 : 0 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{level.level}</h3>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {level.tags.length} tag{level.tags.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => selectLevel(level)}>
                  Edit →
                </button>
              </div>
              {level.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {level.tags.map(tag => (
                    <span key={tag.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: "var(--radius)",
                      background: "var(--bg-input)", border: "1px solid var(--border)",
                      fontSize: 11, opacity: tag.enabled ? 1 : 0.4
                    }}>
                      <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{tag.key}</code>
                      <span style={{ color: "var(--text-muted)" }}>=</span>
                      <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{tag.value}</code>
                      {!tag.enabled && <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 600 }}>OFF</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Merged preview */
        <div style={panelStyle}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Merged Tags for {environment?.name}</h3>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Final tag set applied during deployment ({mergedEntries.length} tags).
            </p>
          </div>
          {mergedEntries.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No enabled tags across any level.
            </div>
          ) : (
            <pre style={{
              fontFamily: "var(--font-mono)", fontSize: 12, padding: 16, margin: 0,
              background: "var(--bg-input)", borderRadius: "var(--radius)",
              lineHeight: 1.6, overflowX: "auto", color: "var(--text-primary)"
            }}>
{mergedEntries.map(([k, v]) => `${k} = "${v}"`).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// Shared styles
const panelStyle = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 10, padding: 18
}
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 }
const theadRowStyle = {
  borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em"
}
const thStyle = { padding: "10px 16px", textAlign: "left" }
const tdStyle = { padding: "10px 16px" }
const codeStyle = {
  fontFamily: "var(--font-mono)", fontSize: 12,
  background: "rgba(110,118,129,0.1)", padding: "2px 6px", borderRadius: 4
}
const badgeActive = {
  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
  background: "rgba(59,130,246,0.1)", color: "var(--green)"
}
const badgeDisabled = {
  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
  background: "rgba(239,68,68,0.1)", color: "var(--red)"
}
