import React, { useState } from "react"

const METHODS = [
  { id: "scan", icon: "☁", iconClass: "scan", title: "Cloud Account Scan", desc: "Connect your AWS or Azure account and auto-discover all resources. Generates diagram and IaC code." },
  { id: "upload", icon: "⬆", iconClass: "upload", title: "Upload IaC Files", desc: "Upload existing Terraform, CloudFormation, or Bicep files. We'll parse and visualize them." },
  { id: "state", icon: "⟳", iconClass: "connect", title: "State File Import", desc: "Import from existing Terraform/OpenTofu state. Full resource mapping with drift detection." },
]

const STEPS = [
  { num: "✓", status: "done", title: "Connect AWS Account", desc: "Cross-account role assumed via arn:aws:iam::123456789:role/f50-scanner" },
  { num: "✓", status: "done", title: "Discover Resources", desc: "Found 47 resources across 3 regions (eu-west-1, eu-central-1, us-east-1)" },
  { num: "3", status: "now", title: "Map Dependencies", desc: "Analyzing VPC peering, security groups, IAM roles, and resource references..." },
  { num: "4", status: "", title: "Generate Diagram", desc: "Create visual layout with subnet zones, connections, and resource grouping" },
  { num: "5", status: "", title: "Generate IaC Code", desc: "Produce OpenTofu/CloudFormation code matching discovered infrastructure" },
  { num: "6", status: "", title: "Review & Adopt", desc: "Review generated code, run plan to verify zero-diff, then adopt into F50 management" },
]

export default function ImportScreen() {
  const [selected, setSelected] = useState("scan")

  return (
    <div className="import-layout">
      <h2>Import Existing Infrastructure</h2>
      <p className="import-subtitle">Bring your existing cloud resources into Factor Fifty for management and visualization.</p>

      <div className="import-methods">
        {METHODS.map(m => (
          <div
            key={m.id}
            className={`imp-method${selected === m.id ? " sel" : ""}`}
            onClick={() => setSelected(m.id)}
          >
            <div className={`imp-icon ${m.iconClass}`}>{m.icon}</div>
            <div className="imp-title">{m.title}</div>
            <div className="imp-desc">{m.desc}</div>
          </div>
        ))}
      </div>

      <div className="import-steps">
        <h3>Cloud Account Scan — Progress</h3>
        {STEPS.map((s, i) => (
          <div className={`istep${s.status ? ` ${s.status}` : ""}`} key={i}>
            <div className="snum">{s.num}</div>
            <div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
