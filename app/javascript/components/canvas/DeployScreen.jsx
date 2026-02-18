import React, { useState, useEffect, useCallback, useRef } from "react"
import { csrf } from "./constants"

const ENGINES = [
  { id: "tofu", logo: "OT", logoClass: "tofu", name: "OpenTofu", desc: "Open-source IaC", enabled: true },
  { id: "cfn", logo: "CF", logoClass: "cfn", name: "CloudFormation", desc: "AWS-native stacks", enabled: false },
  { id: "bicep", logo: "Bi", logoClass: "bicep", name: "Bicep / ARM", desc: "Azure-native IaC", enabled: false },
  { id: "cdk", logo: "CDK", logoClass: "cdk", name: "AWS CDK", desc: "Programmatic IaC", enabled: false },
]

const PIPE_STEPS = [
  { icon: "📋", name: "Validate", detail: "Business rules", key: "validate" },
  { icon: "⚙", name: "Generate", detail: "IR → IaC code", key: "generate" },
  { icon: "📦", name: "Plan", detail: "tofu plan", key: "plan" },
  { icon: "👁", name: "Review", detail: "Manual approval", key: "review" },
  { icon: "🚀", name: "Apply", detail: "tofu apply", key: "apply" },
  { icon: "✅", name: "Verify", detail: "Drift detection", key: "verify" },
]

const STATUS_ICON = { passed: "✓", failed: "✗", pending: "◌" }
const STATUS_CLASS = { passed: "pass", failed: "fail", pending: "pend" }

const STEP_STATUS_ICON = { executing: "⟳", completed: "✓", failed: "✗", skipped: "⊘" }

// Derive pipeline step states from deployment status + checks
function getPipelineStepStates(checks, deployResult) {
  // States: idle | active | completed | failed
  const states = { validate: "idle", generate: "idle", plan: "idle", review: "idle", apply: "idle", verify: "idle" }

  if (!checks && !deployResult) return states

  // Validate: based on pre-checks
  if (checks) {
    const hasBlockers = checks.some(c => c.status === "failed")
    states.validate = hasBlockers ? "failed" : "completed"
  }

  if (!deployResult) return states

  const status = deployResult.status

  // Map deployment statuses to pipeline steps
  if (status === "pending" || status === "dispatched") {
    states.generate = "active"
  } else if (status === "planning") {
    states.generate = "completed"
    states.plan = "active"
  } else if (status === "planned") {
    states.generate = "completed"
    states.plan = "completed"
    states.review = "active"
  } else if (status === "applying") {
    states.generate = "completed"
    states.plan = "completed"
    states.review = "completed"
    states.apply = "active"
  } else if (status === "completed") {
    states.generate = "completed"
    states.plan = "completed"
    states.review = "completed"
    states.apply = "completed"
    states.verify = "completed"
  } else if (status === "failed") {
    // Figure out which step failed based on layers
    const failedLayer = deployResult.layers?.find(l => l.status === "failed")
    const failedStep = failedLayer?.steps?.find(s => s.status === "failed")
    const failedStepName = failedStep?.name || ""

    // Generate-related steps
    const generateSteps = ["generate", "tofu_fmt"]
    const planSteps = ["tofu_init", "tofu_validate", "infracost", "tofu_plan"]
    const applySteps = ["tofu_apply"]

    if (generateSteps.some(s => failedStepName.includes(s))) {
      states.generate = "failed"
    } else if (planSteps.some(s => failedStepName.includes(s))) {
      states.generate = "completed"
      states.plan = "failed"
    } else if (applySteps.some(s => failedStepName.includes(s))) {
      states.generate = "completed"
      states.plan = "completed"
      states.review = "completed"
      states.apply = "failed"
    } else {
      // Generic failure — mark based on deployment status before failure
      states.generate = "failed"
    }
  } else if (status === "rejected") {
    states.generate = "completed"
    states.plan = "completed"
    states.review = "failed"
  }

  return states
}

export default function DeployScreen({ environmentId }) {
  const [selectedEngine] = useState("tofu")
  const [checks, setChecks] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState(null)
  const [error, setError] = useState(null)
  const [runnerConnected, setRunnerConnected] = useState(false)
  const [runnerLoading, setRunnerLoading] = useState(true)
  const [expandedLayers, setExpandedLayers] = useState({})
  const [layerLogs, setLayerLogs] = useState({})
  const [loadingLogs, setLoadingLogs] = useState({})
  const [layerPlans, setLayerPlans] = useState({})
  const [loadingPlans, setLoadingPlans] = useState({})
  const planFetchedRef = useRef({})

  const apiBase = `/api/environments/${environmentId}/deployments`

  const checkRunnerStatus = useCallback(async () => {
    setRunnerLoading(true)
    try {
      const resp = await fetch(`${apiBase}/runner_status`)
      if (resp.ok) {
        const data = await resp.json()
        setRunnerConnected(data.connected)
      }
    } catch (e) {
      // If we can't reach the API, assume not connected
    } finally {
      setRunnerLoading(false)
    }
  }, [apiBase])

  const runPreChecks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${apiBase}/pre_checks`)
      if (resp.ok) {
        const data = await resp.json()
        setChecks(data.checks || [])
      } else {
        setError("Failed to load pre-deployment checks")
      }
    } catch (e) {
      setError("Network error loading checks")
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  // Load checks and runner status on mount
  useEffect(() => { runPreChecks(); checkRunnerStatus() }, [runPreChecks, checkRunnerStatus])

  const hasBlockers = checks && checks.some(c => c.status === "failed")

  const triggerPlan = useCallback(async () => {
    setDeploying(true)
    setDeployResult(null)
    setError(null)
    try {
      const resp = await fetch(`/api/environments/${environmentId}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() }
      })
      if (resp.ok) {
        const data = await resp.json()
        setDeployResult(data)
      } else {
        const data = await resp.json().catch(() => ({}))
        setError(data.error || "Failed to trigger plan")
      }
    } catch (e) {
      setError("Network error triggering plan")
    } finally {
      setDeploying(false)
    }
  }, [environmentId])

  // Poll deployment status while active
  useEffect(() => {
    if (!deployResult?.id) return
    const terminal = ["completed", "failed", "rejected", "planned"]
    if (terminal.includes(deployResult.status)) return

    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${apiBase}/${deployResult.id}`)
        if (resp.ok) {
          const data = await resp.json()
          setDeployResult(data)
          if (terminal.includes(data.status)) clearInterval(interval)
        }
      } catch (e) { /* ignore polling errors */ }
    }, 3000)

    return () => clearInterval(interval)
  }, [deployResult?.id, deployResult?.status, apiBase])

  const approveDeployment = useCallback(async (deploymentId) => {
    try {
      const resp = await fetch(`${apiBase}/${deploymentId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() }
      })
      if (resp.ok) {
        const data = await resp.json()
        setDeployResult(data)
      } else {
        const data = await resp.json().catch(() => ({}))
        setError(data.error || "Failed to approve")
      }
    } catch (e) {
      setError("Network error approving deployment")
    }
  }, [apiBase])

  const rejectDeployment = useCallback(async (deploymentId) => {
    try {
      const resp = await fetch(`${apiBase}/${deploymentId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() }
      })
      if (resp.ok) {
        const data = await resp.json()
        setDeployResult(data)
      } else {
        const data = await resp.json().catch(() => ({}))
        setError(data.error || "Failed to reject")
      }
    } catch (e) {
      setError("Network error rejecting deployment")
    }
  }, [apiBase])

  const toggleLayer = useCallback((layerIndex) => {
    setExpandedLayers(prev => ({ ...prev, [layerIndex]: !prev[layerIndex] }))
  }, [])

  const fetchLayerLogs = useCallback(async (deploymentId, layerIndex) => {
    const key = `${deploymentId}-${layerIndex}`
    if (layerLogs[key]) return // Already fetched
    setLoadingLogs(prev => ({ ...prev, [key]: true }))
    try {
      const resp = await fetch(`${apiBase}/${deploymentId}/logs?layer_index=${layerIndex}`)
      if (resp.ok) {
        const data = await resp.json()
        const logs = data.layers?.[0]?.logs || {}
        setLayerLogs(prev => ({ ...prev, [key]: logs }))
      }
    } catch (e) { /* ignore */ }
    finally { setLoadingLogs(prev => ({ ...prev, [key]: false })) }
  }, [apiBase, layerLogs])

  const fetchLayerPlan = useCallback(async (deploymentId, layerIndex) => {
    const key = `${deploymentId}-${layerIndex}`
    setLoadingPlans(prev => ({ ...prev, [key]: true }))
    try {
      const resp = await fetch(`${apiBase}/${deploymentId}/plan`)
      if (resp.ok) {
        const data = await resp.json()
        const plans = {}
        ;(data.layers || []).forEach(l => {
          plans[`${deploymentId}-${l.layer_index}`] = l.plan_output
        })
        setLayerPlans(prev => ({ ...prev, ...plans }))
      }
    } catch (e) { /* ignore */ }
    finally { setLoadingPlans(prev => ({ ...prev, [key]: false })) }
  }, [apiBase])

  // Auto-fetch plan output when deployment reaches planned/completed status
  useEffect(() => {
    if (!deployResult?.id) return
    if (!["planned", "completed", "applying"].includes(deployResult.status)) return
    const key = `${deployResult.id}-0`
    if (planFetchedRef.current[key]) return
    planFetchedRef.current[key] = true
    fetchLayerPlan(deployResult.id, 0)
  }, [deployResult?.id, deployResult?.status, fetchLayerPlan])

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
    <div className="deploy-layout">
      <h2>Deploy Configuration</h2>
      <p className="deploy-subtitle">Select your IaC engine and review the deployment pipeline. The engine is decoupled from your diagram.</p>

      <div className="engine-grid">
        {ENGINES.map(e => (
          <div
            key={e.id}
            className={`eng-opt${selectedEngine === e.id ? " sel" : ""}${!e.enabled ? " disabled" : ""}`}
            onClick={() => e.enabled && null}
            style={!e.enabled ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : {}}
            title={!e.enabled ? "Coming soon" : ""}
          >
            <div className={`eng-logo ${e.logoClass}`}>{e.logo}</div>
            <div className="eng-name">{e.name}</div>
            <div className="eng-desc">{e.desc}</div>
            {!e.enabled && <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4 }}>Coming soon</div>}
          </div>
        ))}
      </div>

      <div className="pipe-box">
        <div className="pipe-head">
          <h3>Deployment Pipeline</h3>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Engine-agnostic orchestration</span>
        </div>
        <div className="pipe-steps">
          {PIPE_STEPS.map((s, i) => {
            const stepStates = getPipelineStepStates(checks, deployResult)
            const state = stepStates[s.key]
            const stateClass = state === "completed" ? "pstep--done" : state === "active" ? "pstep--active" : state === "failed" ? "pstep--fail" : ""
            const stateIcon = state === "completed" ? "✓" : state === "active" ? "⟳" : state === "failed" ? "✗" : null

            return (
              <React.Fragment key={i}>
                {i > 0 && <div className={`pconnector${state === "completed" || (state === "active" && i > 0) ? " pconnector--done" : ""}`} />}
                <div className={`pstep ${stateClass}`}>
                  <div className="pstep-icon">
                    {stateIcon ? <span className="pstep-state">{stateIcon}</span> : s.icon}
                  </div>
                  <div className="pstep-name">{s.name}</div>
                  <div className="pstep-detail">{s.detail}</div>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <div className="checks-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3>Pre-Deploy Checks</h3>
          <button className="cv-btn cv-btn-secondary cv-btn-sm" onClick={runPreChecks} disabled={loading}>
            {loading ? "Running…" : "↻ Re-run checks"}
          </button>
        </div>

        {error && (
          <div style={{ color: "var(--accent-red)", fontSize: 12, padding: "8px 0" }}>{error}</div>
        )}

        {loading && !checks && (
          <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "16px 0" }}>Running pre-deployment checks…</div>
        )}

        {checks && checks.map((c, i) => (
          <div className="chk" key={i}>
            <div className={`chk-s ${STATUS_CLASS[c.status] || "pend"}`}>
              {STATUS_ICON[c.status] || "◌"}
            </div>
            <div>{c.name} <span>— {c.message}</span></div>
          </div>
        ))}

        {checks && (
          <div className="chk">
            <div className={`chk-s pend`}>◌</div>
            <div>Manual approval <span>— Waiting for project owner sign-off</span></div>
          </div>
        )}
      </div>

      {/* Plan Review — shown when plan output is available */}
      {deployResult && ["planned", "completed", "applying"].includes(deployResult.status) && (() => {
        const allPlans = (deployResult.layers || []).map((layer) => {
          const key = `${deployResult.id}-${layer.index}`
          return { index: layer.index, plan: layerPlans[key], loading: loadingPlans[key] }
        })
        const hasAnyPlan = allPlans.some(p => p.plan)
        const anyLoading = allPlans.some(p => p.loading)
        if (!hasAnyPlan && !anyLoading) return null
        return (
          <div className="checks-box" style={{ marginTop: 16 }}>
            <h3>📋 Plan Review</h3>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>Review the infrastructure changes before approving.</p>
            {allPlans.map(({ index, plan, loading: isLoading }) => (
              <div key={index}>
                {isLoading && <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0" }}>Loading plan for layer {index}…</div>}
                {plan && (
                  <details open style={{ marginBottom: 8 }}>
                    <summary style={{ fontSize: 11, cursor: "pointer", fontWeight: 600, color: "var(--accent-cyan)", marginBottom: 6 }}>
                      Layer {index} — tofu plan
                    </summary>
                    <pre style={{ margin: 0, padding: 12, borderRadius: 6, background: "var(--bg-primary, #0d1117)", color: "var(--text-primary, #e0e0e0)", fontSize: 10, maxHeight: 500, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)", lineHeight: 1.5 }}>
                      {plan}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {deployResult && (
        <div style={{ marginTop: 12, padding: 16, borderRadius: 8, border: `1px solid ${deployResult.status === "failed" ? "var(--accent-red)" : deployResult.status === "completed" || deployResult.status === "planned" ? "var(--accent-green)" : "var(--border)"}`, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span>
              Deployment <code>{deployResult.id?.slice(0, 8)}</code>
              {deployResult.version && <span style={{ marginLeft: 8, color: "var(--accent-cyan)", fontWeight: 600 }}>v{deployResult.version}</span>}
            </span>
            <span className={`mtag ${deployResult.status === "failed" ? "mtag--err" : deployResult.status === "completed" || deployResult.status === "planned" ? "mtag--ok" : "mtag--warn"}`}>
              {deployResult.status}
            </span>
          </div>

          {/* Top-level error from deployment result */}
          {deployResult.result?.error && (
            <div style={{ padding: "8px 10px", marginBottom: 8, borderRadius: 4, background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)", color: "var(--accent-red)", fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {deployResult.result.error}
            </div>
          )}

          {deployResult.layers && deployResult.layers.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {deployResult.layers.map((layer, i) => {
                const isExpanded = expandedLayers[layer.index]
                const logKey = `${deployResult.id}-${layer.index}`
                const logs = layerLogs[logKey]
                const isLoadingLog = loadingLogs[logKey]

                return (
                  <div key={i} style={{ marginBottom: 6, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                    {/* Layer header — clickable */}
                    <div
                      onClick={() => {
                        toggleLayer(layer.index)
                        if (!isExpanded && !logs) fetchLayerLogs(deployResult.id, layer.index)
                      }}
                      style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", fontSize: 11, cursor: "pointer", background: layer.status === "failed" ? "rgba(255,60,60,0.05)" : "transparent" }}
                    >
                      <span style={{ width: 14, textAlign: "center", fontSize: 10, color: "var(--text-muted)" }}>{isExpanded ? "▼" : "▶"}</span>
                      <span style={{ width: 16, textAlign: "center" }}>
                        {layer.status === "completed" ? "✓" : layer.status === "failed" ? "✗" : layer.status === "dispatched" || layer.status === "executing" ? "⟳" : "◌"}
                      </span>
                      <span>Layer {layer.index}</span>
                      <span style={{ color: "var(--text-muted)" }}>— {layer.status}</span>
                      {layer.duration && <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{layer.duration.toFixed(1)}s</span>}
                      {layer.error_details && <span style={{ color: "var(--accent-red)", marginLeft: 8, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>({layer.error_details})</span>}
                    </div>

                    {/* Expanded: step details + error + logs */}
                    {isExpanded && (
                      <div style={{ padding: "4px 10px 10px 38px", borderTop: "1px solid var(--border)" }}>
                        {/* Step breakdown */}
                        {layer.steps && layer.steps.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Steps</div>
                            {layer.steps.map((step, si) => (
                              <div key={si} style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0", fontSize: 11 }}>
                                <span style={{ width: 14, textAlign: "center" }}>{STEP_STATUS_ICON[step.status] || "◌"}</span>
                                <span style={{ fontFamily: "monospace" }}>{step.name}</span>
                                <span style={{ color: "var(--text-muted)" }}>— {step.status}</span>
                                {step.duration != null && <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{step.duration.toFixed(2)}s</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Error details */}
                        {layer.error_details && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: "var(--accent-red)", marginBottom: 4 }}>Error</div>
                            <div style={{ padding: "6px 8px", borderRadius: 4, background: "rgba(255,60,60,0.06)", border: "1px solid rgba(255,60,60,0.15)", fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {layer.error_details}
                            </div>
                          </div>
                        )}

                        {/* Execution logs */}
                        {isLoadingLog && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Loading logs…</div>}
                        {logs && Object.keys(logs).length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Execution Logs</div>
                            {Object.entries(logs).map(([stepName, logContent]) => (
                              <details key={stepName} style={{ marginBottom: 4 }}>
                                <summary style={{ fontSize: 11, cursor: "pointer", fontFamily: "monospace", color: "var(--text-muted)" }}>{stepName}/out.log</summary>
                                <pre style={{ margin: "4px 0", padding: "8px", borderRadius: 4, background: "var(--bg-secondary, #1a1a2e)", color: "var(--text-primary, #e0e0e0)", fontSize: 10, maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)" }}>
                                  {logContent}
                                </pre>
                              </details>
                            ))}
                          </div>
                        )}
                        {logs && Object.keys(logs).length === 0 && !isLoadingLog && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>No logs available yet</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {deployResult.cost_estimate && Object.keys(deployResult.cost_estimate).length > 0 && (() => {
            const cost = deployResult.cost_estimate
            const monthly = parseFloat(cost.totalMonthlyCost || 0)
            const currency = cost.currency || "USD"
            const layers = cost.layers || []
            return (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,200,150,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: layers.length > 0 ? 6 : 0 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>💰 Estimated Monthly Cost</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: monthly > 0 ? "var(--accent-cyan)" : "var(--text-muted)" }}>
                    {currency === "USD" ? "$" : currency} {monthly.toFixed(2)} / mo
                  </span>
                </div>
                {layers.length > 1 && layers.map((lc, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", padding: "2px 0" }}>
                    <span>Layer {lc.layer_index}</span>
                    <span>${parseFloat(lc.totalMonthlyCost || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )
          })()}

          {deployResult.approval_status === "pending_approval" && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button className="cv-btn cv-btn-primary cv-btn-sm" onClick={() => approveDeployment(deployResult.id)}>
                ✓ Approve & Apply
              </button>
              <button className="cv-btn cv-btn-secondary cv-btn-sm" onClick={() => rejectDeployment(deployResult.id)}>
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="cv-btn cv-btn-secondary">Download Generated Code</button>
        <button
          className="cv-btn cv-btn-primary"
          disabled={deploying || hasBlockers || !runnerConnected || (deployResult && !["completed", "failed", "rejected"].includes(deployResult.status))}
          onClick={triggerPlan}
          title={
            hasBlockers ? "Fix blockers before deploying"
            : !runnerConnected ? "No runner connected — deploy a runner first"
            : "Trigger OpenTofu plan"
          }
          style={hasBlockers || !runnerConnected ? { opacity: 0.5, cursor: "not-allowed" } : {}}
        >
          {deploying
            ? "▶ Deploying…"
            : hasBlockers
              ? `▶ Deploy (${checks ? checks.filter(c => c.status === "failed").length : 0} blocker${checks && checks.filter(c => c.status === "failed").length > 1 ? "s" : ""} remaining)`
              : !runnerConnected
                ? "▶ Deploy (runner not connected)"
                : "▶ Deploy"}
        </button>
      </div>
    </div>
    </div>
  )
}
