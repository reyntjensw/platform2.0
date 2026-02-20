import React, { useState, useEffect, useMemo } from "react"
import { csrf } from "./constants"

/* ── severity config ─────────────────────────────── */
const SEV_CONFIG = {
  block: { label: "BLOCKS DEPLOY", className: "sev-block" },
  warn:  { label: "WARNING",       className: "sev-warn" },
  info:  { label: "INFO",          className: "sev-info" },
}

/* ── sidebar category tree ───────────────────────── */
const CATEGORY_TREE = [
  {
    section: "Security",
    icon: "🔒",
    types: ["network_isolation", "encryption", "iam_access", "logging"],
    labels: { network_isolation: "Network Isolation", encryption: "Encryption", iam_access: "IAM & Access", logging: "Logging" },
  },
  {
    section: "Cost",
    icon: "💰",
    types: ["instance_sizing", "reserved_capacity", "tagging"],
    labels: { instance_sizing: "Instance Sizing", reserved_capacity: "Reserved Capacity", tagging: "Tagging" },
  },
  {
    section: "Architecture",
    icon: "🏗️",
    types: ["high_availability", "naming_convention", "region_constraints"],
    labels: { high_availability: "High Availability", naming_convention: "Naming Convention", region_constraints: "Region Constraints" },
  },
  {
    section: "Compliance",
    icon: "📋",
    types: ["gdpr", "soc2", "custom_compliance"],
    labels: { gdpr: "GDPR", soc2: "SOC2", custom_compliance: "Custom" },
  },
]

/* ── builder field/operator definitions ──────────── */
const CONDITION_FIELDS = [
  { value: "resource.type", label: "resource.type" },
  { value: "resource.category", label: "resource.category" },
  { value: "resource.subnet_type", label: "resource.subnet_type" },
  { value: "resource.encryption", label: "resource.encryption" },
  { value: "resource.stateful", label: "resource.stateful" },
  { value: "resource.multi_az", label: "resource.multi_az" },
  { value: "resource.public_access", label: "resource.public_access" },
  { value: "env.type", label: "env.type" },
  { value: "env.region", label: "env.region" },
  { value: "module.name", label: "module.name" },
]

const OPERATORS = [
  { value: "IN", label: "IN", multi: true },
  { value: "NOT_IN", label: "NOT IN", multi: true },
  { value: "==", label: "==", multi: false },
  { value: "!=", label: "!=", multi: false },
  { value: "MUST_BE", label: "MUST BE", multi: false },
  { value: "CONTAINS", label: "CONTAINS", multi: false },
]

const ACTION_OPTIONS = [
  { value: "block_deploy", label: "block_deploy" },
  { value: "warn_on_canvas", label: "warn_on_canvas" },
  { value: "show_validation_error", label: "show_validation_error" },
  { value: "auto_move_to_private", label: "auto_move_to_private" },
  { value: "auto_move_to_public", label: "auto_move_to_public" },
  { value: "auto_move_to_global", label: "auto_move_to_global" },
  { value: "notify_user", label: "notify_user" },
  { value: "block_deploy_review", label: "block_deploy_review" },
  { value: "require_approval", label: "require_approval" },
]

const EMPTY_IF = { field: "", operator: "IN", value: [] }
const EMPTY_THEN = { field: "", operator: "MUST_BE", value: "" }

/* ── helpers: render conditions as pseudo-code ───── */
function conditionToPseudo(cond) {
  const op = cond.operator === "MUST_BE" ? "MUST BE"
    : cond.operator === "NOT_IN" ? "NOT IN"
    : cond.operator
  const val = Array.isArray(cond.value)
    ? `[${cond.value.map(v => `"${v}"`).join(", ")}]`
    : typeof cond.value === "boolean" ? String(cond.value)
    : `"${cond.value}"`
  return `${cond.field} ${op} ${val}`
}

function ruleToPseudoCode(conditions, actions) {
  const lines = []
  if (!conditions) return ""
  const ifConds = (conditions.if_conditions || [])
  const thenConds = (conditions.then_conditions || [])
  const actionList = (actions && actions.action_list) || []
  if (ifConds.length > 0) lines.push(`IF ${ifConds.map(conditionToPseudo).join(" AND ")}`)
  if (thenConds.length > 0) lines.push(`THEN ${thenConds.map(conditionToPseudo).join(" AND ")}`)
  if (actionList.length > 0) lines.push(`ACTION: ${actionList.join(" + ")}`)
  return lines.join("\n")
}

function legacyToPseudoCode(conditions, actions) {
  const lines = []
  if (conditions.categories) lines.push(`IF resource.type IN [${conditions.categories.map(c => `"${c}"`).join(", ")}]`)
  if (conditions.module_names) lines.push(`IF module.name IN [${conditions.module_names.map(m => `"${m}"`).join(", ")}]`)
  if (conditions.restricted_zone) lines.push(`THEN resource.subnet_type MUST BE "${conditions.restricted_zone === "public" ? "private" : conditions.restricted_zone}"`)
  if (actions) {
    const parts = []
    if (actions.auto_move) parts.push(`auto_move_to_${actions.auto_move}`)
    if (actions.notify) parts.push("notify_user")
    if (parts.length) lines.push(`ACTION: ${parts.join(" + ")}`)
  }
  return lines.join("\n")
}

function getRulePseudoCode(rule) {
  if (rule.conditions?.if_conditions) return ruleToPseudoCode(rule.conditions, rule.actions)
  return legacyToPseudoCode(rule.conditions || {}, rule.actions || {})
}

function countByType(rules) {
  const counts = {}
  rules.forEach(r => { const t = r.rule_type || "custom_compliance"; counts[t] = (counts[t] || 0) + 1 })
  return counts
}

/* ── ConditionRow builder component ──────────────── */
function ConditionRow({ condition, onChange, onRemove, prefix }) {
  const isMulti = ["IN", "NOT_IN"].includes(condition.operator)
  return (
    <div className="builder-row">
      <span className="builder-keyword">{prefix}</span>
      <select className="builder-select" value={condition.field}
        onChange={e => onChange({ ...condition, field: e.target.value })}>
        <option value="">field…</option>
        {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select className="builder-select builder-select--op" value={condition.operator}
        onChange={e => {
          const newOp = e.target.value
          const multi = ["IN", "NOT_IN"].includes(newOp)
          const newVal = multi
            ? (Array.isArray(condition.value) ? condition.value : (condition.value ? [condition.value] : []))
            : (Array.isArray(condition.value) ? (condition.value[0] || "") : condition.value)
          onChange({ ...condition, operator: newOp, value: newVal })
        }}>
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {isMulti ? (
        <input className="builder-input" type="text"
          placeholder='comma separated, e.g. rds, dynamodb'
          value={Array.isArray(condition.value) ? condition.value.join(", ") : ""}
          onChange={e => onChange({ ...condition, value: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
      ) : (
        <input className="builder-input" type="text" placeholder="value"
          value={condition.value ?? ""}
          onChange={e => {
            const v = e.target.value
            onChange({ ...condition, value: v === "true" ? true : v === "false" ? false : v })
          }} />
      )}
      <button type="button" className="builder-remove" onClick={onRemove} aria-label="Remove condition">×</button>
    </div>
  )
}

/* ── ActionPicker builder component ──────────────── */
function ActionPicker({ selected, onChange }) {
  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val])
  }
  return (
    <div className="builder-actions">
      <span className="builder-keyword">ACTION</span>
      <div className="builder-action-chips">
        {ACTION_OPTIONS.map(opt => (
          <button key={opt.value} type="button"
            className={`builder-chip${selected.includes(opt.value) ? " active" : ""}`}
            onClick={() => toggle(opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Shared RuleFormModal (create + edit) ─────────── */
function RuleFormModal({ rulesApiUrl, rule, onSaved, onClose, userRole }) {
  const isEdit = !!rule

  // Determine available scopes based on user role
  const isPlatformAdmin = userRole === "platform_admin"
  const isResellerAdmin = userRole === "reseller_admin"
  const scopeOptions = isPlatformAdmin
    ? [{ value: "platform", label: "platform" }, { value: "reseller", label: "reseller" }, { value: "customer", label: "customer" }]
    : isResellerAdmin
      ? [{ value: "reseller", label: "reseller" }, { value: "customer", label: "customer" }]
      : [{ value: "customer", label: "customer" }]
  const defaultScope = rule?.scope_type || scopeOptions[0].value

  // Extract initial values from existing rule for edit mode
  const initIf = isEdit && rule.conditions?.if_conditions?.length
    ? rule.conditions.if_conditions : [{ ...EMPTY_IF }]
  const initThen = isEdit && rule.conditions?.then_conditions?.length
    ? rule.conditions.then_conditions : [{ ...EMPTY_THEN }]
  const initActions = isEdit && rule.actions?.action_list?.length
    ? rule.actions.action_list : []

  const [form, setForm] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    severity: rule?.severity || "info",
    rule_type: rule?.rule_type || "network_isolation",
    scope_type: defaultScope,
    cloud_provider: rule?.cloud_provider || "",
    customer_id: rule?.customer_id || "",
  })
  const [ifConditions, setIfConditions] = useState(initIf)
  const [thenConditions, setThenConditions] = useState(initThen)
  const [actionList, setActionList] = useState(initActions)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const updateCondition = (arr, setArr, idx, val) => {
    const next = [...arr]; next[idx] = val; setArr(next)
  }
  const removeCondition = (arr, setArr, idx) => {
    if (arr.length <= 1) return; setArr(arr.filter((_, i) => i !== idx))
  }

  const preview = useMemo(() => {
    const conds = { if_conditions: ifConditions.filter(c => c.field), then_conditions: thenConditions.filter(c => c.field) }
    return ruleToPseudoCode(conds, { action_list: actionList })
  }, [ifConditions, thenConditions, actionList])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    const conditions = {
      if_conditions: ifConditions.filter(c => c.field),
      then_conditions: thenConditions.filter(c => c.field),
    }
    const actions = { action_list: actionList }

    const body = {
      business_rule: {
        name: form.name, description: form.description,
        severity: form.severity, rule_type: form.rule_type,
        scope_type: form.scope_type, cloud_provider: form.cloud_provider,
        conditions, actions,
        ...(form.scope_type === "customer" && form.customer_id ? { customer_id: parseInt(form.customer_id, 10) } : {}),
      }
    }

    const url = isEdit ? `${rulesApiUrl}/${rule.id}` : rulesApiUrl
    const method = isEdit ? "PATCH" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok || res.status === 201) {
        onSaved(data)
      } else {
        setErrorMsg(data.error || `Failed to ${isEdit ? "update" : "create"} rule`)
      }
    } catch {
      setErrorMsg(`Network error — could not ${isEdit ? "update" : "create"} rule`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ display: "flex" }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ maxWidth: 640, maxHeight: "85vh", overflow: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? "Edit" : "Create"} Business Rule</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {errorMsg && <div style={{ color: "var(--red)", marginBottom: 12, fontSize: 12, padding: "0 24px" }}>{errorMsg}</div>}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
          <div className="builder-grid">
            <label className="modal-label">Name
              <input type="text" name="name" value={form.name} onChange={handleChange} required className="modal-input" />
            </label>
            <label className="modal-label">Severity
              <select name="severity" value={form.severity} onChange={handleChange} className="modal-input">
                <option value="block">block</option><option value="warn">warn</option><option value="info">info</option>
              </select>
            </label>
          </div>
          <label className="modal-label">Description
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="modal-input" />
          </label>
          <div className="builder-grid">
            <label className="modal-label">Rule Type
              <select name="rule_type" value={form.rule_type} onChange={handleChange} className="modal-input">
                {CATEGORY_TREE.flatMap(cat => cat.types.map(t => <option key={t} value={t}>{cat.labels[t]}</option>))}
              </select>
            </label>
            <label className="modal-label">Scope
              <select name="scope_type" value={form.scope_type} onChange={handleChange} className="modal-input">
                {scopeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>
          <div className="builder-grid">
            <div className="modal-label">Cloud Provider
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                {["aws", "azure"].map(cp => {
                  const checked = form.cloud_provider === cp || form.cloud_provider === "multi"
                  return (
                    <label key={cp} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        const other = cp === "aws" ? "azure" : "aws"
                        const otherChecked = form.cloud_provider === other || form.cloud_provider === "multi"
                        let next
                        if (checked) {
                          // unchecking this one
                          next = otherChecked ? other : ""
                        } else {
                          // checking this one
                          next = otherChecked ? "multi" : cp
                        }
                        setForm(prev => ({ ...prev, cloud_provider: next }))
                      }} style={{ accentColor: cp === "aws" ? "var(--aws)" : "var(--azure)", width: 16, height: 16 }} />
                      <span className={`tag tag-${cp}`}>{cp.toUpperCase()}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            {form.scope_type === "customer" && (
              <label className="modal-label">Customer ID
                <input type="number" name="customer_id" value={form.customer_id} onChange={handleChange} className="modal-input" />
              </label>
            )}
          </div>

          {/* ── visual rule builder ── */}
          <div className="builder-section">
            <div className="builder-section-title">Rule Builder</div>
            <div className="builder-group">
              {ifConditions.map((c, i) => (
                <ConditionRow key={i} condition={c} prefix={i === 0 ? "IF" : "AND"}
                  onChange={val => updateCondition(ifConditions, setIfConditions, i, val)}
                  onRemove={() => removeCondition(ifConditions, setIfConditions, i)} />
              ))}
              <button type="button" className="builder-add" onClick={() => setIfConditions(prev => [...prev, { ...EMPTY_IF }])}>+ Add IF condition</button>
            </div>
            <div className="builder-group">
              {thenConditions.map((c, i) => (
                <ConditionRow key={i} condition={c} prefix={i === 0 ? "THEN" : "AND"}
                  onChange={val => updateCondition(thenConditions, setThenConditions, i, val)}
                  onRemove={() => removeCondition(thenConditions, setThenConditions, i)} />
              ))}
              <button type="button" className="builder-add" onClick={() => setThenConditions(prev => [...prev, { ...EMPTY_THEN }])}>+ Add THEN condition</button>
            </div>
            <ActionPicker selected={actionList} onChange={setActionList} />
          </div>

          {preview && (
            <div className="builder-preview">
              <div className="builder-preview-title">Preview</div>
              <pre className="rule-code" style={{ margin: 0 }}>{preview}</pre>
            </div>
          )}

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green" disabled={submitting}>
              {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Rule")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── main component ──────────────────────────────── */
export default function BusinessRulesScreen({ rulesApiUrl, userRole }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeType, setActiveType] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [cloudFilter, setCloudFilter] = useState(null) // null = all, "aws", "azure"
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!rulesApiUrl) return
    setLoading(true); setError(null)
    fetch(rulesApiUrl)
      .then(r => { if (!r.ok) throw new Error("Failed to load rules"); return r.json() })
      .then(data => { setRules(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [rulesApiUrl])

  const typeCounts = useMemo(() => countByType(rules), [rules])

  const filteredRules = useMemo(() => {
    let result = rules
    if (activeType) result = result.filter(r => (r.rule_type || "custom_compliance") === activeType)
    if (cloudFilter) result = result.filter(r => r.cloud_provider === cloudFilter || r.cloud_provider === "multi")
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(r =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [rules, activeType, cloudFilter, searchQuery])

  const activeLabel = useMemo(() => {
    if (!activeType) return "All"
    for (const cat of CATEGORY_TREE) { if (cat.labels[activeType]) return cat.labels[activeType] }
    return activeType
  }, [activeType])

  const toggleRule = async (ruleId, currentEnabled) => {
    const newEnabled = !currentEnabled
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: newEnabled } : r))
    try {
      await fetch(`${rulesApiUrl}/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({ enabled: newEnabled })
      })
    } catch {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: currentEnabled } : r))
    }
  }

  const handleCreated = (newRule) => {
    setRules(prev => [...prev, newRule])
    setShowCreateModal(false)
  }

  const handleEdited = (updatedRule) => {
    setRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r))
    setEditingRule(null)
  }

  const deleteRule = async (ruleId, ruleName) => {
    if (!window.confirm(`Delete rule '${ruleName}'?`)) return
    const removedRule = rules.find(r => r.id === ruleId)
    setRules(prev => prev.filter(r => r.id !== ruleId))
    try {
      const res = await fetch(`${rulesApiUrl}/${ruleId}`, {
        method: "DELETE", headers: { "X-CSRF-Token": csrf() },
      })
      if (!res.ok) throw new Error("Failed to delete rule")
    } catch {
      setRules(prev => [...prev, removedRule])
    }
  }

  if (loading) {
    return <div className="rules-layout"><div style={{ padding: 40, textAlign: "center", width: "100%" }}>Loading business rules…</div></div>
  }

  if (error) {
    return (
      <div className="rules-layout"><div style={{ padding: 40, textAlign: "center", width: "100%" }}>
        <p>Failed to load business rules.</p>
        <button className="btn btn-green" onClick={() => { setLoading(true); setError(null); fetch(rulesApiUrl).then(r => r.json()).then(data => { setRules(data); setLoading(false) }).catch(err => { setError(err.message); setLoading(false) }) }}>Retry</button>
      </div></div>
    )
  }

  return (
    <div className="rules-layout">
      {/* ── sidebar ── */}
      <div className="rules-sidebar">
        <div className={`rnav${!activeType ? " active" : ""}`} onClick={() => setActiveType(null)}>
          All Rules <span className="rc">{rules.length}</span>
        </div>
        {CATEGORY_TREE.map(cat => {
          const sectionCount = cat.types.reduce((sum, t) => sum + (typeCounts[t] || 0), 0)
          if (sectionCount === 0) return null
          return (
            <div key={cat.section}>
              <div className="rcat-title">{cat.icon} {cat.section}</div>
              {cat.types.map(t => {
                const c = typeCounts[t] || 0
                if (c === 0) return null
                return <div key={t} className={`rnav${activeType === t ? " active" : ""}`} onClick={() => setActiveType(t)}>
                  {cat.labels[t]} <span className="rc">{c}</span>
                </div>
              })}
            </div>
          )
        })}
      </div>

      {/* ── main content ── */}
      <div className="rules-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2>{activeLabel} Rules</h2>
            <div className="rules-subtitle">{filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""} · Applied to: All environments</div>
          </div>
          <button className="btn btn-green" onClick={() => setShowCreateModal(true)}>+ Create Rule</button>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <input
            type="text"
            className="modal-input"
            placeholder="Search rules by name or description…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, maxWidth: 320, margin: 0, padding: "8px 12px", fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className={`btn btn-sm${cloudFilter === null ? " btn-green" : " btn-ghost"}`}
              onClick={() => setCloudFilter(null)}
            >All</button>
            <button
              className={`btn btn-sm${cloudFilter === "aws" ? " btn-green" : " btn-ghost"}`}
              style={cloudFilter === "aws" ? { background: "var(--aws)", borderColor: "var(--aws)" } : {}}
              onClick={() => setCloudFilter(cloudFilter === "aws" ? null : "aws")}
            >☁️ AWS</button>
            <button
              className={`btn btn-sm${cloudFilter === "azure" ? " btn-green" : " btn-ghost"}`}
              style={cloudFilter === "azure" ? { background: "var(--azure)", borderColor: "var(--azure)" } : {}}
              onClick={() => setCloudFilter(cloudFilter === "azure" ? null : "azure")}
            >☁️ Azure</button>
          </div>
        </div>

        {showCreateModal && (
          <RuleFormModal rulesApiUrl={rulesApiUrl} rule={null} onSaved={handleCreated} onClose={() => setShowCreateModal(false)} userRole={userRole} />
        )}
        {editingRule && (
          <RuleFormModal rulesApiUrl={rulesApiUrl} rule={editingRule} onSaved={handleEdited} onClose={() => setEditingRule(null)} userRole={userRole} />
        )}

        {filteredRules.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#8b99b5" }}>No business rules configured for this category.</div>
        )}

        {filteredRules.map(rule => {
          const sev = SEV_CONFIG[rule.severity] || SEV_CONFIG.info
          const pseudo = getRulePseudoCode(rule)
          return (
            <div className="rule-card" key={rule.id}>
              <div className="rule-head">
                <span className={`sev ${sev.className}`}>{sev.label}</span>
                <span className="rule-name">{rule.name}</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}
                  onClick={() => setEditingRule(rule)} aria-label={`Edit ${rule.name}`}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm"
                  onClick={() => deleteRule(rule.id, rule.name)} aria-label={`Delete ${rule.name}`}>
                  Delete
                </button>
                <div className={`rp-toggle${rule.enabled ? " on" : ""}`} style={{ marginLeft: "auto" }}
                  onClick={() => toggleRule(rule.id, rule.enabled)} role="switch"
                  aria-checked={rule.enabled} aria-label={`Toggle ${rule.name}`} />
              </div>
              <div className="rule-desc">{rule.description}</div>
              {pseudo && (
                <div className="rule-code">
                  {pseudo.split("\n").map((line, i) => {
                    const keyword = line.match(/^(IF|THEN|AND|ACTION:)/)
                    return <div key={i}>{keyword
                      ? <><span className="rc-keyword">{keyword[1]}</span> {line.slice(keyword[1].length)}</>
                      : line}</div>
                  })}
                </div>
              )}
              <div className="rule-meta">
                <span>{rule.scope_type === "platform" ? "All envs" : rule.scope_type === "reseller" ? "Reseller-specific" : "Customer-specific"}</span>
                <span>👤 {rule.scope_type}</span>
                <span>☁️ {rule.cloud_provider}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
