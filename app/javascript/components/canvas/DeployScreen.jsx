import React, { useState } from "react"

const ENGINES = [
  { id: "tofu", logo: "OT", logoClass: "tofu", name: "OpenTofu", desc: "Open-source IaC" },
  { id: "cfn", logo: "CF", logoClass: "cfn", name: "CloudFormation", desc: "AWS-native stacks" },
  { id: "bicep", logo: "Bi", logoClass: "bicep", name: "Bicep / ARM", desc: "Azure-native IaC" },
  { id: "cdk", logo: "CDK", logoClass: "cdk", name: "AWS CDK", desc: "Programmatic IaC" },
]

const PIPE_STEPS = [
  { icon: "📋", name: "Validate", detail: "Business rules" },
  { icon: "⚙", name: "Generate", detail: "IR → IaC code" },
  { icon: "📦", name: "Plan", detail: "tofu plan / cfn changeset" },
  { icon: "👁", name: "Review", detail: "Manual approval" },
  { icon: "🚀", name: "Apply", detail: "tofu apply / deploy stack" },
  { icon: "✅", name: "Verify", detail: "Drift detection" },
]

const CHECKS = [
  { status: "pass", icon: "✓", label: "Business rules validation", detail: "14/14 rules passed" },
  { status: "pass", icon: "✓", label: "Cross-env references", detail: "All outputs resolvable" },
  { status: "fail", icon: "✗", label: "Encryption compliance", detail: 'S3 "static-assets" missing encryption' },
  { status: "pass", icon: "✓", label: "IAM least privilege", detail: "No wildcard permissions detected" },
  { status: "pass", icon: "✓", label: "Cost estimation", detail: "~$2,340/mo (within budget of $3,000)" },
  { status: "pend", icon: "◌", label: "Manual approval", detail: "Waiting for project owner sign-off" },
]

export default function DeployScreen() {
  const [selectedEngine, setSelectedEngine] = useState("tofu")

  return (
    <div className="deploy-layout">
      <h2>Deploy Configuration</h2>
      <p className="deploy-subtitle">Select your IaC engine and review the deployment pipeline. The engine is decoupled from your diagram.</p>

      <div className="engine-grid">
        {ENGINES.map(e => (
          <div
            key={e.id}
            className={`eng-opt${selectedEngine === e.id ? " sel" : ""}`}
            onClick={() => setSelectedEngine(e.id)}
          >
            <div className={`eng-logo ${e.logoClass}`}>{e.logo}</div>
            <div className="eng-name">{e.name}</div>
            <div className="eng-desc">{e.desc}</div>
          </div>
        ))}
      </div>

      <div className="pipe-box">
        <div className="pipe-head">
          <h3>Deployment Pipeline</h3>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Engine-agnostic orchestration</span>
        </div>
        <div className="pipe-steps">
          {PIPE_STEPS.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="pconnector" />}
              <div className="pstep">
                <div className="pstep-icon">{s.icon}</div>
                <div className="pstep-name">{s.name}</div>
                <div className="pstep-detail">{s.detail}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="checks-box">
        <h3>Pre-Deploy Checks</h3>
        {CHECKS.map((c, i) => (
          <div className="chk" key={i}>
            <div className={`chk-s ${c.status}`}>{c.icon}</div>
            <div>{c.label} <span>— {c.detail}</span></div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="cv-btn cv-btn-secondary">Download Generated Code</button>
        <button className="cv-btn cv-btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }}>▶ Deploy (1 blocker remaining)</button>
      </div>
    </div>
  )
}
