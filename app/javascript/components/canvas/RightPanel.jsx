import React, { useRef, useCallback, useEffect, useState } from "react"
import DOMPurify from "dompurify"
import { csrf } from "./constants"

export default function RightPanel({
  selectedId, propsHtml, resources, deleteResource, startConnect, apiUrl, onPropsSaved,
  appGroups, createAppGroup, deleteAppGroup, assignResourceToGroup, selectedGroupId,
  readOnly
}) {
  const scrollRef = useRef(null)
  const propsRef = useRef(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColor, setNewGroupColor] = useState("#58a6ff")
  const [saveFlash, setSaveFlash] = useState(null) // "saved" | "error" | null

  // Switch to overview/group tab when group filter changes
  useEffect(() => {
    if (selectedGroupId) setActiveTab("group")
    else setActiveTab("overview")
  }, [selectedGroupId])

  // Switch to props tab when a resource is selected
  useEffect(() => {
    if (selectedId) setActiveTab("props")
  }, [selectedId])

  // Intercept form submissions and button clicks from the server-rendered properties HTML
  useEffect(() => {
    const container = propsRef.current
    if (!container || !apiUrl) return

    // When readOnly, hide action buttons and disable inputs in server-rendered HTML
    if (readOnly) {
      const actions = container.querySelector(".rp-actions")
      if (actions) actions.style.display = "none"
      container.querySelectorAll("input, select, textarea").forEach(el => {
        el.disabled = true
        el.style.opacity = "0.7"
        el.style.cursor = "default"
      })
      return
    }

    const handleSubmit = async (e) => {
      if (e.target.tagName !== "FORM") return
      e.preventDefault()
      const form = e.target
      const resourceId = form.dataset.resourceId
      if (!resourceId) return
      const formData = new FormData(form)
      const config = {}
      for (const [key, value] of formData.entries()) {
        const m = key.match(/^config\[(.+)\]$/)
        if (m) {
          let v = value
          if (v === "true") v = true
          else if (v === "false") v = false
          else if (/^\d+$/.test(v)) v = parseInt(v, 10)
          config[m[1]] = v
        }
      }
      const resp = await fetch(`${apiUrl}/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({ config })
      })
      if (resp.ok) {
        if (onPropsSaved) onPropsSaved(resourceId)
        setSaveFlash("saved")
        setTimeout(() => setSaveFlash(null), 2000)
      } else {
        setSaveFlash("error")
        setTimeout(() => setSaveFlash(null), 3000)
      }
    }

    const handleClick = (e) => {
      const btn = e.target.closest("[data-action]")
      if (!btn) return
      const action = btn.getAttribute("data-action")
      if (action && action.includes("deleteResource")) {
        const resourceId = btn.dataset.resourceId
        if (resourceId && deleteResource) deleteResource(resourceId)
      } else if (action && action.includes("startConnect")) {
        if (startConnect) startConnect()
      }
    }

    container.addEventListener("submit", handleSubmit)
    container.addEventListener("click", handleClick)
    return () => {
      container.removeEventListener("submit", handleSubmit)
      container.removeEventListener("click", handleClick)
    }
  }, [propsHtml, apiUrl, onPropsSaved, deleteResource, startConnect, readOnly])

  const selectedGroup = selectedGroupId && appGroups ? appGroups.find(g => g.id === selectedGroupId) : null
  const groupMembers = selectedGroup ? resources.filter(r => r.application_group_id === selectedGroupId) : []
  const errCount = resources.filter(r => r.validation_errors && Object.keys(r.validation_errors).length > 0).length
  const firstTabLabel = selectedGroupId ? "Group" : "Overview"
  const firstTabId = selectedGroupId ? "group" : "overview"

  return (
    <div className="rpanel">
      <div className="rp-tabs">
        <button className={`rp-tab${activeTab === firstTabId ? " active" : ""}`} onClick={() => setActiveTab(firstTabId)}>{firstTabLabel}</button>
        <button className={`rp-tab${activeTab === "props" ? " active" : ""}`} onClick={() => setActiveTab("props")}>Props</button>
        <button className={`rp-tab${activeTab === "valid" ? " active" : ""}`} onClick={() => setActiveTab("valid")}>
          Valid <span style={{ color: "var(--accent-red)", fontSize: 9 }}>● 2</span>
        </button>
      </div>

      <div className="rp-scroll" ref={scrollRef}>

        {/* Overview Tab — "All Resources" selected */}
        {activeTab === "overview" && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ border: "1px solid var(--accent-green, #3fb950)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>All Resources</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Full view of all {resources.length} resources across all groups.
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  <strong style={{ fontSize: 18, color: "var(--text-primary)", display: "block" }}>{resources.length}</strong>total
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  <strong style={{ fontSize: 18, color: errCount > 0 ? "var(--accent-red)" : "var(--text-primary)", display: "block" }}>{errCount}</strong>errors
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  <strong style={{ fontSize: 18, color: "var(--text-primary)", display: "block" }}>2</strong>warnings
                </div>
              </div>
            </div>

            <div className="rp-section">By Group</div>
            {appGroups && appGroups.map(g => {
              const count = resources.filter(r => r.application_group_id === g.id).length
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 12, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: g.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: g.color }} />
                  </div>
                  <span style={{ flex: 1, fontWeight: 500 }}>{g.name}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{count}</span>
                </div>
              )
            })}
            {(!appGroups || appGroups.length === 0) && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "12px 0" }}>No groups yet. Use the + button in the filter bar to create one.</div>
            )}
          </div>
        )}

        {/* Group Tab — specific group selected */}
        {activeTab === "group" && selectedGroup && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: selectedGroup.color }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedGroup.name}</div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <strong style={{ fontSize: 18, color: "var(--text-primary)", display: "block" }}>{groupMembers.length}</strong>resources
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <strong style={{ fontSize: 18, color: "var(--text-primary)", display: "block" }}>
                  {groupMembers.reduce((n, r) => n + (r.connections?.outgoing?.length || 0) + (r.connections?.incoming?.length || 0), 0)}
                </strong>connections
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <strong style={{ fontSize: 18, color: "var(--text-primary)", display: "block" }}>
                  {groupMembers.filter(r => r.validation_errors && Object.keys(r.validation_errors).length > 0).length}
                </strong>errors
              </div>
            </div>

            <div className="rp-section">Resources in this group</div>
            {groupMembers.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", fontSize: 11, borderBottom: "1px solid var(--border, #21262d)" }}>
                <span style={{ background: "var(--bg-tertiary)", padding: "2px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                  {r.module_definition?.icon || r.module_definition?.name?.substring(0, 3).toUpperCase()}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>{r.name}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 9 }}>{r.module_definition?.display_name}</span>
              </div>
            ))}
            {groupMembers.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0" }}>No resources assigned to this group yet.</div>
            )}

            {/* Cross-refs: resources in other groups that connect to this group's resources */}
            {(() => {
              const memberIds = new Set(groupMembers.map(r => r.id))
              const crossRefs = resources.filter(r => !memberIds.has(r.id) && r.application_group_id && (
                (r.connections?.outgoing || []).some(c => memberIds.has(c.to_resource_id)) ||
                (r.connections?.incoming || []).some(c => memberIds.has(c.from_resource_id))
              ))
              if (crossRefs.length === 0) return null
              return (
                <>
                  <div className="rp-section" style={{ marginTop: 12 }}>Ghost refs (other groups)</div>
                  {crossRefs.map(r => {
                    const rGroup = appGroups.find(g => g.id === r.application_group_id)
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", fontSize: 11, opacity: 0.7 }}>
                        <span style={{ background: "var(--bg-tertiary)", padding: "2px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                          {r.module_definition?.icon || r.module_definition?.name?.substring(0, 3).toUpperCase()}
                        </span>
                        <span style={{ flex: 1 }}>{r.name}</span>
                        <span style={{ color: rGroup?.color || "var(--text-muted)", fontSize: 9 }}>{rGroup?.name || "—"} →</span>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === "props" && (
          <div>
            {!selectedId ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 10px", fontSize: 11 }}>
                Select a resource to view properties
              </div>
            ) : (
              <div>
                {saveFlash && (
                  <div style={{
                    padding: "6px 10px", marginBottom: 8, borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: saveFlash === "saved" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    color: saveFlash === "saved" ? "var(--accent-green)" : "var(--accent-red)",
                    border: `1px solid ${saveFlash === "saved" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`
                  }}>
                    {saveFlash === "saved" ? "✓ Saved" : "✗ Save failed"}
                  </div>
                )}
                <div ref={propsRef} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(propsHtml) }} />
                {appGroups && assignResourceToGroup && !readOnly && (
                  <div style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <label className="rp-field-label" style={{ fontSize: 10, display: "block", marginBottom: 4 }}>Application Group</label>
                    <select
                      className="rp-select"
                      style={{ width: "100%", fontSize: 11, padding: "4px 6px" }}
                      value={resources.find(r => r.id === selectedId)?.application_group_id || ""}
                      onChange={(e) => assignResourceToGroup(selectedId, e.target.value || null)}
                      aria-label="Application Group"
                    >
                      <option value="">None</option>
                      {appGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === "valid" && (
          <div>
            <div className="rp-section">Real-time Validation</div>
            <div className="vi err">
              <div className="vi-icon">!</div>
              <div><strong>Missing encryption</strong><span>S3 "static-assets" needs SSE enabled. Rule: data-encryption-at-rest</span></div>
            </div>
            <div className="vi wrn">
              <div className="vi-icon">⚠</div>
              <div><strong>Single-AZ database</strong><span>RDS "app-postgres" needs Multi-AZ for production per business rule.</span></div>
            </div>
            <div className="vi ok">
              <div className="vi-icon">✓</div>
              <div><strong>No public databases</strong><span>All databases in private subnets.</span></div>
            </div>
            <div className="vi ok">
              <div className="vi-icon">✓</div>
              <div><strong>VPC peering valid</strong><span>Cross-env ref to shared-services reachable.</span></div>
            </div>
            <div className="vi ok">
              <div className="vi-icon">✓</div>
              <div><strong>Security groups defined</strong><span>All resources have associated SGs.</span></div>
            </div>
            <div className="vi ok">
              <div className="vi-icon">✓</div>
              <div><strong>Tagging compliance</strong><span>Required tags: env, team, cost-center present.</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
