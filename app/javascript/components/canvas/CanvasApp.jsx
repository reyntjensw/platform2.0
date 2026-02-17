import React, { useState, useRef, useCallback, useEffect } from "react"
import CatalogPanel from "./CatalogPanel"
import CanvasArea from "./CanvasArea"
import RightPanel from "./RightPanel"
import CommandPalette from "./CommandPalette"
import BusinessRulesScreen from "./BusinessRulesScreen"
import PromoteScreen from "./PromoteScreen"
import TemplatesScreen from "./TemplatesScreen"
import ImportScreen from "./ImportScreen"
import DeployScreen from "./DeployScreen"
import { csrf } from "./constants"

const GROUP_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#bc8cff", "#39d2c0", "#f778ba", "#79c0ff"]

function CreateGroupModal({ onCreate, onClose }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    await onCreate(name.trim(), color)
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="modal-content" style={{ background: "var(--bg-secondary, #161b22)", border: "1px solid var(--border, #30363d)", borderRadius: 10, padding: 24, width: 360, color: "var(--text-primary, #e6edf3)" }}>
        <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Create Application Group</h3>
        <form onSubmit={handleSubmit}>
          <label className="modal-label">
            Name
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="modal-input" placeholder="e.g. Compute, Data, Networking"
              autoFocus required
            />
          </label>
          <label className="modal-label">
            Color
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {GROUP_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: c, border: color === c ? "2px solid white" : "2px solid transparent",
                    cursor: "pointer", transition: "border-color 0.15s"
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" className="cv-btn cv-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="cv-btn cv-btn-primary" disabled={!name.trim() || submitting}>
              {submitting ? "Creating…" : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CanvasApp({
  initialResources, initialConnections, catalogModules,
  apiUrl, connectionsApiUrl, businessRulesApiUrl, applicationGroupsApiUrl,
  environmentId, environment, project, customer, siblingEnvs, currentUser,
  canvasPath, rootPath
}) {
  const [resources, setResources] = useState(initialResources || [])
  const [connections, setConnections] = useState(initialConnections || [])
  const [selectedId, setSelectedId] = useState(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [propsHtml, setPropsHtml] = useState("")
  const [cloudFilter, setCloudFilter] = useState(null)
  const [activeScreen, setActiveScreen] = useState("canvas")
  const [toasts, setToasts] = useState([])

  // Connect mode
  const [connectMode, setConnectMode] = useState(false)
  const [connectFromId, setConnectFromId] = useState(null)

  // Application groups
  const [appGroups, setAppGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)

  useEffect(() => {
    if (!applicationGroupsApiUrl) return
    fetch(applicationGroupsApiUrl).then(r => r.ok ? r.json() : []).then(setAppGroups)
  }, [applicationGroupsApiUrl])

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  // Cmd+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true) }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  // Load properties HTML when selection changes
  useEffect(() => {
    if (!selectedId) { setPropsHtml(""); return }
    fetch(`${apiUrl}/${selectedId}/properties`, { headers: { Accept: "text/html" } })
      .then(r => r.ok ? r.text() : "")
      .then(setPropsHtml)
  }, [selectedId, apiUrl])

  const selectResource = useCallback((id) => {
    setSelectedId(id === selectedId ? null : id)
  }, [selectedId])

  const deselectAll = useCallback(() => setSelectedId(null), [])

  const addResource = useCallback(async (moduleId, posX, posY) => {
    const body = { module_definition_id: moduleId }
    if (posX != null) body.position_x = posX
    if (posY != null) body.position_y = posY
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify(body)
    })
    if (resp.ok) {
      const resource = await resp.json()
      resource.connections = resource.connections || { outgoing: [], incoming: [] }
      setResources(prev => [...prev, resource])
      setSelectedId(resource.id)
      if (resource.warnings && resource.warnings.length > 0) {
        resource.warnings.forEach(w => addToast(w.message || w.rule_name, "warn"))
      }
    } else if (resp.status === 422) {
      const data = await resp.json()
      if (data.violations && data.violations.length > 0) {
        data.violations.forEach(v => addToast(v.message || v.rule_name, "error"))
      } else if (data.error) {
        addToast(data.error, "error")
      }
    }
  }, [apiUrl, addToast])

  const updateResourcePosition = useCallback(async (id, x, y) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, position_x: x, position_y: y } : r))
    await fetch(`${apiUrl}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ position_x: x, position_y: y })
    })
  }, [apiUrl])

  const deleteResource = useCallback(async (id) => {
    if (!confirm("Delete this resource?")) return
    const resp = await fetch(`${apiUrl}/${id}`, {
      method: "DELETE", headers: { "X-CSRF-Token": csrf() }
    })
    if (resp.ok) {
      setResources(prev => prev.filter(r => r.id !== id))
      setConnections(prev => prev.filter(c => c.from_resource_id !== id && c.to_resource_id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }, [apiUrl, selectedId])

  const createConnection = useCallback(async (fromId, toId) => {
    if (connections.some(c => c.from_resource_id === fromId && c.to_resource_id === toId)) return
    const resp = await fetch(connectionsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ from_resource_id: fromId, to_resource_id: toId, connection_type: "dependency" })
    })
    if (resp.ok) {
      const conn = await resp.json()
      setConnections(prev => [...prev, conn])
    }
  }, [connectionsApiUrl, connections])

  const startConnect = useCallback((id) => {
    setConnectMode(true)
    setConnectFromId(id || selectedId)
  }, [selectedId])

  const completeConnect = useCallback((toId) => {
    if (connectFromId && toId !== connectFromId) {
      createConnection(connectFromId, toId)
    }
    setConnectMode(false)
    setConnectFromId(null)
  }, [connectFromId, createConnection])

  const cancelConnect = useCallback(() => {
    setConnectMode(false)
    setConnectFromId(null)
  }, [])

  // Application group CRUD
  const createAppGroup = useCallback(async (name, color) => {
    const resp = await fetch(applicationGroupsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ name, color })
    })
    if (resp.ok) {
      const group = await resp.json()
      setAppGroups(prev => [...prev, group])
      return group
    }
    return null
  }, [applicationGroupsApiUrl])

  const deleteAppGroup = useCallback(async (groupId) => {
    const resp = await fetch(`${applicationGroupsApiUrl}/${groupId}`, {
      method: "DELETE", headers: { "X-CSRF-Token": csrf() }
    })
    if (resp.ok) {
      setAppGroups(prev => prev.filter(g => g.id !== groupId))
      setResources(prev => prev.map(r =>
        r.application_group_id === groupId ? { ...r, application_group_id: null } : r
      ))
    }
  }, [applicationGroupsApiUrl])

  const assignResourceToGroup = useCallback(async (resourceId, groupId) => {
    const resp = await fetch(`${apiUrl}/${resourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ application_group_id: groupId })
    })
    if (resp.ok) {
      setResources(prev => prev.map(r =>
        r.id === resourceId ? { ...r, application_group_id: groupId } : r
      ))
      // Update appGroups resource_ids
      setAppGroups(prev => prev.map(g => ({
        ...g,
        resource_ids: g.id === groupId
          ? [...(g.resource_ids || []).filter(id => id !== resourceId), resourceId]
          : (g.resource_ids || []).filter(id => id !== resourceId)
      })))
    }
  }, [apiUrl])

  return (
    <div className="cv-app">
      {/* Top Nav */}
      <nav className="cv-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href={rootPath} className="cv-logo" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="cv-logo-bars" aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
            Factor Fifty
          </a>
          <div className="cv-breadcrumb">
            <span>{customer.name}</span> <span>›</span>
            <span>{project.name}</span> <span>›</span>
            <span className="curr">{environment.name}</span>
          </div>
        </div>
        <div className="cv-top-right">
          <a href="/modules" className="cv-btn cv-btn-secondary cv-btn-sm" style={{ textDecoration: "none" }}>📦 Modules</a>
          <button className="cv-btn cv-btn-secondary cv-btn-sm">✦ New Environment</button>
          <button className="cv-btn cv-btn-primary cv-btn-sm" onClick={() => setActiveScreen("deploy")}>▶ Deploy</button>
          <div className="cv-avatar">{currentUser || "U"}</div>
        </div>
      </nav>

      {/* Screen Selector */}
      <div className="screen-selector">
        {[
          { id: "canvas", label: "① Canvas & Guardrails" },
          { id: "rules", label: "② Business Rules" },
          { id: "promote", label: "③ Promote & Sync" },
          { id: "templates", label: "④ Templates" },
          { id: "import", label: "⑤ Import" },
          { id: "deploy", label: "⑥ Deploy & IaC Engine" },
        ].map(s => (
          <button
            key={s.id}
            className={`screen-btn${activeScreen === s.id ? " active" : ""}`}
            onClick={() => setActiveScreen(s.id)}
          >{s.label}</button>
        ))}
      </div>

      {/* Screen content */}
      {activeScreen === "canvas" && (
        <>
          {/* App Group Filter Bar — always visible */}
          <div className="group-filter-bar">
            <button
              className={`group-filter-tab${!selectedGroupId ? " active" : ""}`}
              onClick={() => setSelectedGroupId(null)}
            >
              <span className="group-filter-dot" style={{ background: "var(--text-muted)" }} />
              All Resources <span className="group-filter-count">{resources.length}</span>
            </button>
            {appGroups.map(g => {
              const count = resources.filter(r => r.application_group_id === g.id).length
              return (
                <button
                  key={g.id}
                  className={`group-filter-tab${selectedGroupId === g.id ? " active" : ""}`}
                  onClick={() => setSelectedGroupId(selectedGroupId === g.id ? null : g.id)}
                >
                  <span className="group-filter-dot" style={{ background: g.color }} />
                  {g.name} <span className="group-filter-count">{count}</span>
                </button>
              )
            })}
            <button
              className="group-filter-tab"
              style={{ borderStyle: "dashed" }}
              onClick={() => setShowCreateGroupModal(true)}
            >+</button>
          </div>
          {showCreateGroupModal && (
            <CreateGroupModal
              onCreate={async (name, color) => {
                const g = await createAppGroup(name, color)
                if (g) setShowCreateGroupModal(false)
              }}
              onClose={() => setShowCreateGroupModal(false)}
            />
          )}
          <div className="cv-main">
          <CatalogPanel
            modules={catalogModules}
            cloudFilter={cloudFilter}
            setCloudFilter={setCloudFilter}
            onAddResource={addResource}
          />
          <CanvasArea
            resources={selectedGroupId ? resources.filter(r => r.application_group_id === selectedGroupId) : resources}
            connections={connections}
            selectedId={selectedId}
            selectResource={selectResource}
            deselectAll={deselectAll}
            updateResourcePosition={updateResourcePosition}
            addResource={addResource}
            connectMode={connectMode}
            connectFromId={connectFromId}
            completeConnect={completeConnect}
            cancelConnect={cancelConnect}
            startConnect={startConnect}
            onOpenCmd={() => setCmdOpen(true)}
            siblingEnvs={siblingEnvs}
            environment={environment}
            canvasPath={canvasPath}
            appGroups={appGroups}
          />
          <RightPanel
            selectedId={selectedId}
            propsHtml={propsHtml}
            resources={resources}
            deleteResource={deleteResource}
            startConnect={() => startConnect(selectedId)}
            apiUrl={apiUrl}
            onPropsSaved={(id) => {
              fetch(`${apiUrl}/${id}/properties`, { headers: { Accept: "text/html" } })
                .then(r => r.ok ? r.text() : "")
                .then(setPropsHtml)
            }}
            appGroups={appGroups}
            createAppGroup={createAppGroup}
            deleteAppGroup={deleteAppGroup}
            assignResourceToGroup={assignResourceToGroup}
            selectedGroupId={selectedGroupId}
          />
        </div>
        </>
      )}
      {activeScreen === "rules" && <BusinessRulesScreen rulesApiUrl={businessRulesApiUrl} />}
      {activeScreen === "promote" && <PromoteScreen />}
      {activeScreen === "templates" && <TemplatesScreen />}
      {activeScreen === "import" && <ImportScreen />}
      {activeScreen === "deploy" && <DeployScreen />}

      {/* Command Palette */}
      {cmdOpen && (
        <CommandPalette
          resources={resources}
          catalogModules={catalogModules}
          onClose={() => setCmdOpen(false)}
          onSelectResource={(id) => { selectResource(id); setCmdOpen(false) }}
          onAddModule={(id) => { addResource(id); setCmdOpen(false) }}
        />
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="cv-toasts">
          {toasts.map(t => (
            <div key={t.id} className={`cv-toast cv-toast-${t.type}`}>
              <span>{t.type === "error" ? "🚫" : "⚠️"} {t.message}</span>
              <button className="cv-toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
