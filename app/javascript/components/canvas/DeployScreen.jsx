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
  { icon: "💰", name: "Cost", detail: "Cost estimate", key: "cost" },
  { icon: "👁", name: "Review", detail: "Manual approval", key: "review" },
  { icon: "🚀", name: "Apply", detail: "tofu apply", key: "apply" },
  { icon: "✅", name: "Verify", detail: "Drift detection", key: "verify" },
]

const STATUS_ICON = { passed: "✓", failed: "✗", pending: "◌" }
const STATUS_CLASS = { passed: "pass", failed: "fail", pending: "pend" }

const STEP_STATUS_ICON = { executing: "⟳", completed: "✓", failed: "✗", skipped: "⊘" }
const HIDDEN_LOGS = new Set(["tofu_fmt", "tofu_validate"])
const HIDDEN_APPLY_STEPS = new Set(["cleanup", "generate", "infracost", "tofu_init", "tofu_validate"])
const INTERNAL_LOG_PATTERN = /^(tofu_apply: (starting|completed|failed)|Updated status for step )/

// Parse apply log: extract @message from JSON lines, skip init noise and internal status lines
function formatApplyLog(raw) {
  const lines = raw.split(/\r?\n/)
  const result = []
  let seenJson = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (INTERNAL_LOG_PATTERN.test(trimmed)) continue

    if (trimmed.startsWith('{')) {
      seenJson = true
      try {
        const obj = JSON.parse(trimmed)
        const msg = obj["@message"]
        if (!msg) continue
        const type = obj.type || ''
        if (type === 'version') continue
        result.push(msg)
      } catch {
        result.push(line)
      }
    } else if (!seenJson) {
      // Pre-JSON lines are init output — skip them (init, downloading modules, etc.)
      continue
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

// Derive pipeline step states from deployment status + checks
function getPipelineStepStates(checks, deployResult) {
  // States: idle | active | completed | failed
  const states = { validate: "idle", generate: "idle", plan: "idle", cost: "idle", review: "idle", apply: "idle", verify: "idle" }

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
    states.cost = "completed"
    states.review = "active"
  } else if (status === "applying") {
    states.generate = "completed"
    states.plan = "completed"
    states.cost = "completed"
    states.review = "completed"
    states.apply = "active"
  } else if (status === "completed") {
    states.generate = "completed"
    states.plan = "completed"
    states.cost = "completed"
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
    const planSteps = ["tofu_init", "tofu_validate", "tofu_plan"]
    const costSteps = ["infracost"]
    const applySteps = ["tofu_apply"]

    if (generateSteps.some(s => failedStepName.includes(s))) {
      states.generate = "failed"
    } else if (planSteps.some(s => failedStepName.includes(s))) {
      states.generate = "completed"
      states.plan = "failed"
    } else if (costSteps.some(s => failedStepName.includes(s))) {
      states.generate = "completed"
      states.plan = "completed"
      states.cost = "failed"
    } else if (applySteps.some(s => failedStepName.includes(s))) {
      states.generate = "completed"
      states.plan = "completed"
      states.cost = "completed"
      states.review = "completed"
      states.apply = "failed"
    } else {
      // Generic failure — mark based on deployment status before failure
      states.generate = "failed"
    }
  } else if (status === "rejected") {
    states.generate = "completed"
    states.plan = "completed"
    states.cost = "completed"
    states.review = "failed"
  }

  return states
}

export default function DeployScreen({ environmentId, canManage = true }) {
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
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showCostModal, setShowCostModal] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [infracostData, setInfracostData] = useState(null)
  const [loadingInfracost, setLoadingInfracost] = useState(false)
  const planFetchedRef = useRef({})
  const [checksExpanded, setChecksExpanded] = useState(false)
  const [planSearch, setPlanSearch] = useState("")
  const [applySearch, setApplySearch] = useState("")
  const applyLogsFetchedRef = useRef({})

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

  const fetchLayerLogs = useCallback(async (deploymentId, layerIndex, force = false) => {
    const key = `${deploymentId}-${layerIndex}`
    if (!force && layerLogs[key]) return // Already fetched (skip unless forced)
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
          if (l.plan_output) {
            plans[`${deploymentId}-${l.layer_index}`] = l.plan_output
          }
        })
        // Fallback: if S3 returned nothing, use plan_output from the deployment layers (DB)
        if (Object.keys(plans).length === 0 && deployResult?.layers) {
          deployResult.layers.forEach(l => {
            if (l.plan_output) {
              plans[`${deploymentId}-${l.index}`] = l.plan_output
            }
          })
        }
        setLayerPlans(prev => ({ ...prev, ...plans }))
      }
    } catch (e) { /* ignore */ }
    finally { setLoadingPlans(prev => ({ ...prev, [key]: false })) }
  }, [apiBase, deployResult])

  const fetchInfracostData = useCallback(async (deploymentId) => {
    setLoadingInfracost(true)
    try {
      const resp = await fetch(`${apiBase}/${deploymentId}/infracost`)
      if (resp.ok) {
        const data = await resp.json()
        const layers = data.layers || []
        // Fallback: if S3 returned no cost_data, use cost_estimate from deployment layers (DB)
        if (layers.every(l => !l.cost_data) && deployResult?.layers) {
          const fallbackLayers = deployResult.layers
            .filter(l => l.cost_estimate && Object.keys(l.cost_estimate).length > 0)
            .map(l => ({ layer_index: l.index, cost_data: l.cost_estimate }))
          if (fallbackLayers.length > 0) {
            setInfracostData(fallbackLayers)
            return
          }
        }
        setInfracostData(layers)
      }
    } catch (e) { /* ignore */ }
    finally { setLoadingInfracost(false) }
  }, [apiBase, deployResult])

  // Auto-fetch plan output when deployment reaches planned/completed status
  useEffect(() => {
    if (!deployResult?.id) return
    if (!["planned", "completed", "applying"].includes(deployResult.status)) return
    const key = `${deployResult.id}-0`
    if (planFetchedRef.current[key]) return
    planFetchedRef.current[key] = true
    fetchLayerPlan(deployResult.id, 0)
  }, [deployResult?.id, deployResult?.status, fetchLayerPlan])

  // Auto-open apply modal when deployment enters applying status
  useEffect(() => {
    if (deployResult?.status === "applying") {
      setShowApplyModal(true)
    }
  }, [deployResult?.status])

  // Auto-fetch logs when apply modal is open and deployment is applying/completed/failed
  useEffect(() => {
    if (!showApplyModal || !deployResult?.id) return
    if (!["applying", "completed", "failed"].includes(deployResult.status)) return

    // Initial fetch (or force re-fetch on terminal status to get final logs)
    const isTerminal = deployResult.status === "completed" || deployResult.status === "failed"
    ;(deployResult.layers || []).forEach(layer => {
      const key = `${deployResult.id}-${layer.index}`
      const terminalKey = `${key}-terminal`
      if (!applyLogsFetchedRef.current[key]) {
        applyLogsFetchedRef.current[key] = true
        fetchLayerLogs(deployResult.id, layer.index)
      } else if (isTerminal && !applyLogsFetchedRef.current[terminalKey]) {
        // Force re-fetch once when reaching terminal status to get complete logs
        applyLogsFetchedRef.current[terminalKey] = true
        fetchLayerLogs(deployResult.id, layer.index, true)
      }
    })

    // Re-fetch logs periodically while applying so output updates live
    if (deployResult.status !== "applying") return
    const logPollInterval = setInterval(() => {
      ;(deployResult.layers || []).forEach(layer => {
        fetchLayerLogs(deployResult.id, layer.index, true)
      })
    }, 5000)
    return () => clearInterval(logPollInterval)
  }, [showApplyModal, deployResult?.id, deployResult?.status, deployResult?.layers, fetchLayerLogs])

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
            const isClickable = ((s.key === "plan" || s.key === "cost") && state === "completed" && deployResult)
              || (s.key === "apply" && (state === "active" || state === "completed" || state === "failed") && deployResult)

            return (
              <React.Fragment key={i}>
                {i > 0 && <div className={`pconnector${state === "completed" || (state === "active" && i > 0) ? " pconnector--done" : ""}`} />}
                <div
                  className={`pstep ${stateClass}`}
                  onClick={isClickable ? () => {
                    if (s.key === "plan") {
                      setShowPlanModal(true)
                      // Ensure plan data is fetched
                      if (deployResult.layers) {
                        deployResult.layers.forEach(l => {
                          const key = `${deployResult.id}-${l.index}`
                          if (!layerPlans[key]) fetchLayerPlan(deployResult.id, l.index)
                        })
                      }
                    } else if (s.key === "cost") {
                      setShowCostModal(true)
                      // Fetch cost data if not already loaded
                      if (!infracostData) fetchInfracostData(deployResult.id)
                    } else if (s.key === "apply") {
                      setShowApplyModal(true)
                    }
                  } : undefined}
                  style={isClickable ? { cursor: "pointer" } : undefined}
                  title={isClickable ? "Click to view plan output" : undefined}
                >
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

      {(() => {
        const allChecks = checks ? [...checks] : null
        const passedCount = allChecks ? allChecks.filter(c => c.status === "passed").length : 0
        const totalCount = allChecks ? allChecks.length : 0
        const allPassed = passedCount === totalCount
        const scoreColor = !allChecks ? "var(--text-muted)" : allPassed ? "var(--accent-green)" : "var(--accent-yellow, #e8a735)"

        return (
          <div className="checks-box">
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => setChecksExpanded(prev => !prev)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{checksExpanded ? "▼" : "▶"}</span>
                <h3 style={{ margin: 0 }}>Pre-Deploy Checks</h3>
                {allChecks && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor }}>
                    {passedCount}/{totalCount} passed
                  </span>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); runPreChecks() }} disabled={loading}>
                {loading ? "Running…" : "↻ Re-run checks"}
              </button>
            </div>

            {error && (
              <div style={{ color: "var(--accent-red)", fontSize: 12, padding: "8px 0" }}>{error}</div>
            )}

            {loading && !checks && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "16px 0" }}>Running pre-deployment checks…</div>
            )}

            {checksExpanded && allChecks && allChecks.map((c, i) => (
              <div className="chk" key={i}>
                <div className={`chk-s ${STATUS_CLASS[c.status] || "pend"}`}>
                  {STATUS_ICON[c.status] || "◌"}
                </div>
                <div>{c.name} <span>— {c.message}</span></div>
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
                        {layer.steps && layer.steps.filter(s => !HIDDEN_APPLY_STEPS.has(s.name)).length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Steps</div>
                            {layer.steps.filter(s => !HIDDEN_APPLY_STEPS.has(s.name)).map((step, si) => (
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
                            {Object.entries(logs).filter(([stepName]) => !HIDDEN_LOGS.has(stepName)).map(([stepName, logContent]) => (
                              <details key={stepName} style={{ marginBottom: 4 }}>
                                <summary style={{ fontSize: 11, cursor: "pointer", fontFamily: "monospace", color: "var(--text-muted)" }}>{stepName}/out.log</summary>
                                <pre style={{ margin: "4px 0", padding: "8px", borderRadius: 4, background: "var(--bg-secondary, #1a1a2e)", color: "var(--text-primary, #e8ecf4)", fontSize: 10, maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)" }}>
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

          {deployResult.approval_status === "pending_approval" && canManage && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button className="btn btn-green btn-sm" onClick={() => approveDeployment(deployResult.id)}>
                ✓ Approve & Apply
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => rejectDeployment(deployResult.id)}>
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        {(() => {
          const pipelineRunning = deployResult && !["completed", "failed", "rejected"].includes(deployResult.status)
          const isDisabled = deploying || hasBlockers || !runnerConnected || pipelineRunning
          return (
            <button
              className="btn btn-green"
              disabled={isDisabled}
              onClick={triggerPlan}
              title={
                pipelineRunning ? "Pipeline is running"
                : hasBlockers ? "Fix blockers before running"
                : !runnerConnected ? "No runner connected — deploy a runner first"
                : "Run OpenTofu plan"
              }
              style={isDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {}}
            >
              {deploying
                ? "⟳ Running…"
                : pipelineRunning
                  ? "⟳ Pipeline running…"
                  : hasBlockers
                    ? `▶ Run Pipeline (${checks ? checks.filter(c => c.status === "failed").length : 0} blocker${checks && checks.filter(c => c.status === "failed").length > 1 ? "s" : ""} remaining)`
                    : !runnerConnected
                      ? "▶ Run Pipeline (runner not connected)"
                      : "▶ Run Pipeline"}
            </button>
          )
        })()}
      </div>

      {/* Plan Output Modal */}
      {showPlanModal && deployResult && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setShowPlanModal(false); setPlanSearch("") }}
        >
          <div
            style={{ width: "80%", maxWidth: 900, maxHeight: "80vh", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary, #1a1a2e)", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>📦 Plan Output — Deployment v{deployResult.version}</span>
              <button
                onClick={() => { setShowPlanModal(false); setPlanSearch("") }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                aria-label="Close plan modal"
              >✕</button>
            </div>
            <div style={{ padding: "10px 20px 0", borderBottom: "1px solid var(--border)" }}>
              <input
                type="text"
                value={planSearch}
                onChange={e => setPlanSearch(e.target.value)}
                placeholder="Search plan output…"
                autoFocus
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary, #0a0e1a)", color: "var(--text-primary, #e8ecf4)", outline: "none", marginBottom: 10 }}
              />
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {(deployResult.layers || []).map((layer) => {
                const key = `${deployResult.id}-${layer.index}`
                const plan = layerPlans[key]
                const isLoading = loadingPlans[key]
                const search = planSearch.trim().toLowerCase()

                // Filter: if searching and plan doesn't contain the term, hide this layer
                if (search && plan && !plan.toLowerCase().includes(search)) return null

                return (
                  <div key={layer.index} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-cyan)", marginBottom: 8 }}>Layer {layer.index}</div>
                    {isLoading && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading plan…</div>}
                    {plan ? (
                      <pre style={{ margin: 0, padding: 14, borderRadius: 6, background: "var(--bg-primary, #0a0e1a)", color: "var(--text-primary, #e8ecf4)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)", lineHeight: 1.6 }}>
                        {search ? plan.split('\n').filter(line => line.toLowerCase().includes(search)).join('\n') : plan}
                      </pre>
                    ) : !isLoading ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No plan output available</div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cost Modal */}
      {showCostModal && deployResult && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowCostModal(false)}
        >
          <div
            style={{ width: "80%", maxWidth: 900, maxHeight: "80vh", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary, #1a1a2e)", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>💰 Cost Estimate — Deployment v{deployResult.version}</span>
              <button
                onClick={() => setShowCostModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                aria-label="Close cost modal"
              >✕</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {loadingInfracost && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading cost data…</div>}
              {infracostData && infracostData.map((layer) => {
                const cost = layer.cost_data
                if (!cost) return (
                  <div key={layer.layer_index} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-cyan)", marginBottom: 8 }}>Layer {layer.layer_index}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No cost data available</div>
                  </div>
                )
                const monthly = parseFloat(cost.totalMonthlyCost || 0)
                const currency = cost.currency || "USD"
                const projects = cost.projects || []
                return (
                  <div key={layer.layer_index} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-cyan)" }}>Layer {layer.layer_index}</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: monthly > 0 ? "var(--accent-cyan)" : "var(--text-muted)" }}>
                        {currency === "USD" ? "$" : currency} {monthly.toFixed(2)} / mo
                      </span>
                    </div>
                    {projects.map((proj, pi) => (
                      <div key={pi} style={{ marginBottom: 12 }}>
                        {(proj.breakdown?.resources || []).map((res, ri) => {
                          const resCost = parseFloat(res.monthlyCost || 0)
                          return (
                            <div key={ri} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, borderBottom: "1px solid var(--border)" }}>
                              <span style={{ fontFamily: "monospace" }}>{res.name}</span>
                              <span style={{ color: resCost > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>${resCost.toFixed(2)}</span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
              })}
              {!loadingInfracost && !infracostData && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No cost data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Progress Modal */}
      {showApplyModal && deployResult && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setShowApplyModal(false); setApplySearch("") }}
        >
          <div
            style={{ width: "80%", maxWidth: 900, maxHeight: "80vh", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-secondary, #1a1a2e)", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>🚀 Apply Output — Deployment v{deployResult.version}</span>
                <span className={`mtag ${deployResult.status === "failed" ? "mtag--err" : deployResult.status === "completed" ? "mtag--ok" : "mtag--warn"}`} style={{ fontSize: 10 }}>
                  {deployResult.status}
                </span>
              </div>
              <button
                onClick={() => { setShowApplyModal(false); setApplySearch("") }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                aria-label="Close apply modal"
              >✕</button>
            </div>
            <div style={{ padding: "10px 20px 0", borderBottom: "1px solid var(--border)" }}>
              <input
                type="text"
                value={applySearch}
                onChange={e => setApplySearch(e.target.value)}
                placeholder="Search apply output…"
                autoFocus
                style={{ width: "100%", padding: "8px 10px", marginBottom: 10, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary, #0a0e1a)", color: "var(--text-primary, #e8ecf4)", fontSize: 12, outline: "none" }}
              />
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {(deployResult.layers || []).map((layer) => {
                const isApplyLayer = ["applying", "completed", "failed"].includes(deployResult.status)
                if (!isApplyLayer) return null

                const stepIcon = (status) => status === "completed" ? "✓" : status === "failed" ? "✗" : status === "executing" ? "⟳" : status === "skipped" ? "⊘" : "◌"
                const stepColor = (status) => status === "completed" ? "var(--accent-green)" : status === "failed" ? "var(--accent-red)" : status === "executing" ? "var(--accent-cyan)" : "var(--text-muted)"

                const logKey = `${deployResult.id}-${layer.index}`
                const logs = layerLogs[logKey]
                const isLoadingLog = loadingLogs[logKey]
                const applyLog = logs?.["tofu_apply"] || null
                const otherLogs = logs ? Object.fromEntries(Object.entries(logs).filter(([k]) => k !== "tofu_apply" && !HIDDEN_LOGS.has(k))) : null
                const search = applySearch.trim().toLowerCase()

                // If searching and apply log doesn't match, hide this layer
                if (search && applyLog && !applyLog.toLowerCase().includes(search)) return null

                return (
                  <div key={layer.index} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ color: stepColor(layer.status), fontSize: 14 }}>{stepIcon(layer.status)}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-cyan)" }}>Layer {layer.index}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— {layer.status}</span>
                      {layer.status === "executing" && (
                        <span style={{ fontSize: 10, color: "var(--accent-cyan)", animation: "pulse 1.5s infinite" }}>running…</span>
                      )}
                    </div>

                    {/* Step progress */}
                    {layer.steps && layer.steps.filter(s => !HIDDEN_APPLY_STEPS.has(s.name)).length > 0 && (
                      <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary, #0a0e1a)" }}>
                        {layer.steps.filter(s => !HIDDEN_APPLY_STEPS.has(s.name)).map((step, si) => (
                          <div key={si} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 11 }}>
                            <span style={{ width: 16, textAlign: "center", color: stepColor(step.status) }}>{stepIcon(step.status)}</span>
                            <span style={{ fontFamily: "monospace", flex: 1 }}>{step.name}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{step.status}</span>
                            {step.duration != null && <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{step.duration.toFixed(2)}s</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error */}
                    {layer.error_details && (
                      <div style={{ padding: "8px 10px", marginBottom: 8, borderRadius: 4, background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)", color: "var(--accent-red)", fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                        {layer.error_details}
                      </div>
                    )}

                    {/* Apply output — shown prominently like plan output */}
                    {isLoadingLog && !applyLog && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading apply output…</div>}
                    {applyLog ? (() => {
                      const formatted = formatApplyLog(applyLog)
                      const displayed = search ? formatted.split('\n').filter(line => line.toLowerCase().includes(search)).join('\n') : formatted
                      return (
                        <pre style={{ margin: 0, padding: 14, borderRadius: 6, background: "var(--bg-primary, #0a0e1a)", color: "var(--text-primary, #e8ecf4)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)", lineHeight: 1.6, maxHeight: 400, overflow: "auto" }}>
                          {displayed}
                        </pre>
                      )
                    })() : !isLoadingLog && logs ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No apply output available yet</div>
                    ) : null}

                    {/* Other logs — collapsible */}
                    {otherLogs && Object.keys(otherLogs).length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, cursor: "pointer", color: "var(--text-muted)" }}>Other execution logs ({Object.keys(otherLogs).length})</summary>
                        <div style={{ marginTop: 6 }}>
                          {Object.entries(otherLogs).map(([stepName, logContent]) => (
                            <details key={stepName} style={{ marginBottom: 4 }}>
                              <summary style={{ fontSize: 10, cursor: "pointer", fontFamily: "monospace", color: "var(--text-muted)" }}>{stepName}/out.log</summary>
                              <pre style={{ margin: "4px 0", padding: "8px", borderRadius: 4, background: "var(--bg-primary, #0a0e1a)", color: "var(--text-primary, #e8ecf4)", fontSize: 10, maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)" }}>
                                {logContent}
                              </pre>
                            </details>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              })}

              {deployResult.status === "completed" && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 6, border: "1px solid var(--accent-green)", background: "rgba(0,200,100,0.06)", fontSize: 12, color: "var(--accent-green)", textAlign: "center" }}>
                  ✓ Apply completed successfully
                </div>
              )}
              {deployResult.status === "failed" && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 6, border: "1px solid var(--accent-red)", background: "rgba(255,60,60,0.06)", fontSize: 12, color: "var(--accent-red)", textAlign: "center" }}>
                  ✗ Apply failed
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
