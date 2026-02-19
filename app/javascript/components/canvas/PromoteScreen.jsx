import React, { useState, useEffect, useCallback, useMemo } from "react"
import { csrf } from "./constants"

const ENV_DOTS = { dev: "var(--accent-green)", acc: "var(--accent-orange)", prd: "var(--accent-red)" }

function timeAgo(dateStr) {
  if (!dateStr) return "never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function PromoteScreen({ project, environment, siblingEnvs, promotionsApiUrl }) {
  // Pipeline state
  const [environments, setEnvironments] = useState([])
  const [changeCounts, setChangeCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Diff view state
  const [diffView, setDiffView] = useState(null) // { sourceEnv, targetEnv }
  const [diffReport, setDiffReport] = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [appGroupFilter, setAppGroupFilter] = useState(null)
  const [excludedIds, setExcludedIds] = useState(new Set())

  // Plan / promote state
  const [planOutput, setPlanOutput] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promotionResult, setPromotionResult] = useState(null)

  // Fetch pipeline data
  const fetchPipeline = useCallback(async () => {
    if (!promotionsApiUrl) return
    setLoading(true); setError(null)
    try {
      const resp = await fetch(`${promotionsApiUrl}/pipeline`)
      if (!resp.ok) throw new Error("Failed to load pipeline")
      const data = await resp.json()
      setEnvironments(data.environments || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [promotionsApiUrl])

  useEffect(() => { fetchPipeline() }, [fetchPipeline])

  // Fetch change counts between adjacent environments
  useEffect(() => {
    if (environments.length < 2 || !promotionsApiUrl) return
    const pairs = []
    for (let i = 0; i < environments.length - 1; i++) {
      pairs.push([environments[i], environments[i + 1]])
    }
    pairs.forEach(async ([src, tgt]) => {
      try {
        const resp = await fetch(
          `${promotionsApiUrl}/diff?source_env_id=${src.id}&target_env_id=${tgt.id}`
        )
        if (resp.ok) {
          const data = await resp.json()
          const total = (data.summary?.added || 0) + (data.summary?.modified || 0) + (data.summary?.removed || 0)
          setChangeCounts(prev => ({ ...prev, [`${src.id}-${tgt.id}`]: total }))
        }
      } catch (_) { /* ignore diff errors for arrow counts */ }
    })
  }, [environments, promotionsApiUrl])

  // Fetch diff when user clicks promote
  const openDiff = useCallback(async (sourceEnv, targetEnv) => {
    setDiffView({ sourceEnv, targetEnv })
    setDiffReport(null); setDiffLoading(true)
    setPlanOutput(null); setPromotionResult(null)
    setExcludedIds(new Set()); setAppGroupFilter(null)
    try {
      const url = `${promotionsApiUrl}/diff?source_env_id=${sourceEnv.id}&target_env_id=${targetEnv.id}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error("Failed to load diff")
      setDiffReport(await resp.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setDiffLoading(false)
    }
  }, [promotionsApiUrl])

  // Refetch diff when app group filter changes
  useEffect(() => {
    if (!diffView) return
    const { sourceEnv, targetEnv } = diffView
    setDiffLoading(true); setDiffReport(null)
    const params = new URLSearchParams({
      source_env_id: sourceEnv.id,
      target_env_id: targetEnv.id
    })
    if (appGroupFilter) params.set("app_group_id", appGroupFilter)
    fetch(`${promotionsApiUrl}/diff?${params}`)
      .then(r => r.ok ? r.json() : Promise.reject("Failed"))
      .then(data => { setDiffReport(data); setDiffLoading(false) })
      .catch(() => setDiffLoading(false))
  }, [appGroupFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle resource exclusion
  const toggleExclude = useCallback((resourceId) => {
    setExcludedIds(prev => {
      const next = new Set(prev)
      next.has(resourceId) ? next.delete(resourceId) : next.add(resourceId)
      return next
    })
  }, [])

  // Preview plan
  const handlePreview = useCallback(async () => {
    if (!diffView) return
    setPlanLoading(true); setPlanOutput(null)
    try {
      const resp = await fetch(`${promotionsApiUrl}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({
          source_env_id: diffView.sourceEnv.id,
          target_env_id: diffView.targetEnv.id,
          app_group_id: appGroupFilter || undefined,
          excluded_resource_ids: [...excludedIds]
        })
      })
      if (!resp.ok) throw new Error("Preview failed")
      const data = await resp.json()
      setPlanOutput(typeof data.plan_output === 'string' ? data.plan_output : JSON.stringify(data.plan_output, null, 2))
    } catch (e) {
      setPlanOutput(`Error: ${e.message}`)
    } finally {
      setPlanLoading(false)
    }
  }, [diffView, promotionsApiUrl, appGroupFilter, excludedIds])

  // Promote (non-production)
  const handlePromote = useCallback(async () => {
    if (!diffView) return
    setPromoting(true); setPromotionResult(null)
    try {
      const resp = await fetch(promotionsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({
          source_env_id: diffView.sourceEnv.id,
          target_env_id: diffView.targetEnv.id,
          app_group_id: appGroupFilter || undefined,
          excluded_resource_ids: [...excludedIds]
        })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `Promotion failed (${resp.status})`)
      }
      const data = await resp.json()
      setPromotionResult(data)
      // Refresh pipeline after promotion
      setDiffView(null)
      fetchPipeline()
    } catch (e) {
      setPromotionResult({ error: e.message })
    } finally {
      setPromoting(false)
    }
  }, [diffView, promotionsApiUrl, appGroupFilter, excludedIds, fetchPipeline])

  // Approve & promote (production)
  const handleApprovePromote = useCallback(async () => {
    // First create the promotion (which will be awaiting_approval for prd)
    if (!diffView) return
    setPromoting(true); setPromotionResult(null)
    try {
      const createResp = await fetch(promotionsApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({
          source_env_id: diffView.sourceEnv.id,
          target_env_id: diffView.targetEnv.id,
          app_group_id: appGroupFilter || undefined,
          excluded_resource_ids: [...excludedIds]
        })
      })
      if (!createResp.ok) {
        const err = await createResp.json().catch(() => ({}))
        throw new Error(err.error || `Promotion failed (${createResp.status})`)
      }
      const record = await createResp.json()

      // Then approve it
      const approveResp = await fetch(`${promotionsApiUrl}/${record.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() }
      })
      if (!approveResp.ok) {
        const err = await approveResp.json().catch(() => ({}))
        throw new Error(err.error || `Approval failed (${approveResp.status})`)
      }
      const approved = await approveResp.json()
      setPromotionResult(approved)
      setDiffView(null)
      fetchPipeline()
    } catch (e) {
      setPromotionResult({ error: e.message })
    } finally {
      setPromoting(false)
    }
  }, [diffView, promotionsApiUrl, appGroupFilter, excludedIds, fetchPipeline])

  // Collect unique app groups from diff for filter dropdown
  const appGroups = useMemo(() => {
    if (!diffReport) return []
    const groups = new Map()
    const allItems = [...(diffReport.added || []), ...(diffReport.modified || []), ...(diffReport.removed || [])]
    allItems.forEach(item => {
      if (item.application_group_id && item.application_group_name) {
        groups.set(item.application_group_id, item.application_group_name)
      }
    })
    return [...groups.entries()].map(([id, name]) => ({ id, name }))
  }, [diffReport])

  // All diff items for rendering
  const diffItems = useMemo(() => {
    if (!diffReport) return []
    return [
      ...(diffReport.added || []).map(r => ({ ...r, type: "add" })),
      ...(diffReport.modified || []).map(r => ({ ...r, type: "mod" })),
      ...(diffReport.removed || []).map(r => ({ ...r, type: "rem" }))
    ]
  }, [diffReport])

  const isPrd = diffView?.targetEnv?.env_type === "prd"

  // ── Render ──

  if (loading) {
    return (
      <div className="promote-layout">
        <h2>Environment Promotion Pipeline</h2>
        <p className="promote-subtitle">Loading pipeline…</p>
      </div>
    )
  }

  if (error && !environments.length) {
    return (
      <div className="promote-layout">
        <h2>Environment Promotion Pipeline</h2>
        <p className="promote-subtitle" style={{ color: "var(--accent-red)" }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="promote-layout">
      <h2>Environment Promotion Pipeline</h2>
      <p className="promote-subtitle">Compare, diff, and promote infrastructure changes across environments.</p>

      {/* Pipeline view */}
      <div className="pipeline">
        {environments.map((env, i) => (
          <React.Fragment key={env.id}>
            {i > 0 && (
              <div className="arrow-col">
                <button
                  className="promote-btn2"
                  disabled={promoting}
                  onClick={() => openDiff(environments[i - 1], env)}
                >Promote →</button>
                <div className="arrow-line" />
                <span className="arrow-note">
                  {(() => {
                    const key = `${environments[i - 1].id}-${env.id}`
                    const count = changeCounts[key]
                    if (count === undefined) return "…"
                    if (count === 0) return "in sync"
                    return `${count} change${count !== 1 ? "s" : ""}`
                  })()}
                </span>
              </div>
            )}
            <div className={`stage${env.id === environment?.id ? " active-s" : ""}`}>
              <div className="stage-head">
                <div className="env-dot" style={{ background: ENV_DOTS[env.env_type] || "var(--text-muted)" }} />
                <div className="stage-name">{env.name}</div>
                <div className="stage-ver">v{env.version || "0.0.0"}</div>
              </div>
              <div className="stage-meta">Last deployed: {timeAgo(env.last_deployed_at)}</div>
              <div className="stage-meta">{env.resource_count} resources</div>
              <div className="stage-chips">
                {Object.entries(env.resource_summary || {}).map(([cat, count]) => (
                  <span className="chip" key={cat}>{cat} ×{count}</span>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Promotion result toast */}
      {promotionResult && (
        <div style={{
          padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 12,
          background: promotionResult.error ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
          border: `1px solid ${promotionResult.error ? "var(--accent-red)" : "var(--accent-green)"}`,
          color: promotionResult.error ? "var(--accent-red)" : "var(--accent-green)"
        }}>
          {promotionResult.error
            ? `Promotion failed: ${promotionResult.error}`
            : `Promotion ${promotionResult.status || "completed"} successfully`}
        </div>
      )}

      {/* Diff view */}
      {diffView && (
        <>
          <div className="diff-box">
            <div className="diff-head">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h3>Diff: {diffView.sourceEnv.name} → {diffView.targetEnv.name}</h3>
                {appGroups.length > 0 && (
                  <select
                    value={appGroupFilter || ""}
                    onChange={e => setAppGroupFilter(e.target.value || null)}
                    style={{
                      fontSize: 11, padding: "3px 6px", background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)"
                    }}
                  >
                    <option value="">All Resources</option>
                    {appGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {diffReport && (
                <div className="diff-stats">
                  <span className="a">+{diffReport.summary?.added || 0} added</span>
                  <span className="m">~{diffReport.summary?.modified || 0} modified</span>
                  <span className="r">-{diffReport.summary?.removed || 0} removed</span>
                </div>
              )}
            </div>
            <div className="diff-body">
              {diffLoading && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 8 }}>Loading diff…</div>}
              {!diffLoading && diffItems.length === 0 && diffReport && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 8 }}>No changes detected — environments are in sync.</div>
              )}
              {diffItems.map((item, idx) => {
                const rid = item.resource_id || item.resource_name || idx
                const isExcluded = excludedIds.has(rid)
                return (
                  <div
                    className={`ditem d${item.type[0]}`}
                    key={rid}
                    style={isExcluded ? { opacity: 0.4, textDecoration: "line-through" } : {}}
                  >
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => toggleExclude(rid)}
                      title={isExcluded ? "Include in promotion" : "Exclude from promotion"}
                      style={{ marginRight: 4, cursor: "pointer" }}
                    />
                    <span className="dbadge">{item.type === "add" ? "added" : item.type === "mod" ? "modified" : "removed"}</span>
                    <span>
                      <strong>{item.resource_name || item.name}</strong>
                      {item.module_name && <> — {item.module_name}</>}
                      {item.type === "mod" && item.changes && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
                          ({Object.keys(item.changes).join(", ")})
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Plan output */}
          {planOutput && (
            <div style={{
              marginTop: 12, background: "var(--bg-tertiary)", border: "1px solid var(--border)",
              borderRadius: 8, padding: 14, maxHeight: 300, overflowY: "auto"
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Preview Plan Output</div>
              <pre style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap" }}>
                {planOutput}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
            <button className="btn btn-ghost" onClick={() => setDiffView(null)}>← Back</button>
            <button
              className="btn btn-ghost"
              onClick={handlePreview}
              disabled={planLoading || !diffReport}
            >
              {planLoading ? "Loading plan…" : "Preview Plan"}
            </button>
            {isPrd ? (
              <button
                className="btn btn-green"
                onClick={handleApprovePromote}
                disabled={promoting || !diffReport}
              >
                {promoting ? "Promoting…" : "Approve & Promote"}
              </button>
            ) : (
              <button
                className="btn btn-green"
                onClick={handlePromote}
                disabled={promoting || !diffReport}
              >
                {promoting ? "Promoting…" : `Promote to ${diffView.targetEnv.name}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
