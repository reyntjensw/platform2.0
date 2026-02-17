import React, { useState } from "react"

const FILTERS = ["All", "AWS", "Azure", "Multi-Cloud", "Starter", "Production-Ready", "My Templates"]

const TEMPLATES = [
  {
    title: "Production Web Platform",
    desc: "EKS + RDS PostgreSQL + ElastiCache Redis + ALB + S3. Includes Karpenter, monitoring, security best practices.",
    badge: "AWS", badgeClass: "aws", uses: 47,
    tags: ["EKS", "HA", "Production"],
    blocks: [
      { label: "EKS", bg: "rgba(34,211,238,0.12)", color: "var(--accent-cyan)" },
      { label: "RDS", bg: "rgba(59,130,246,0.12)", color: "var(--accent-blue)" },
      { label: "EC", bg: "rgba(59,130,246,0.12)", color: "var(--accent-blue)" },
      { label: "ALB", bg: "rgba(139,92,246,0.12)", color: "var(--accent-purple)" },
      { label: "S3", bg: "rgba(16,185,129,0.12)", color: "var(--accent-green)" },
      { label: "IAM", bg: "rgba(239,68,68,0.12)", color: "var(--accent-red)" },
    ],
  },
  {
    title: "Serverless API Backend",
    desc: "Lambda + API Gateway + DynamoDB + S3. Event-driven, auto-scaling, pay-per-use architecture.",
    badge: "AWS", badgeClass: "aws", uses: 31,
    tags: ["Serverless", "API", "Starter"],
    blocks: [
      { label: "λ", bg: "rgba(255,153,0,0.12)", color: "var(--aws-orange)" },
      { label: "DDB", bg: "rgba(59,130,246,0.12)", color: "var(--accent-blue)" },
      { label: "API", bg: "rgba(139,92,246,0.12)", color: "var(--accent-purple)" },
      { label: "S3", bg: "rgba(16,185,129,0.12)", color: "var(--accent-green)" },
    ],
  },
  {
    title: "Azure Microservices",
    desc: "AKS + Azure SQL + Key Vault + Application Gateway. Enterprise-grade with AAD integration.",
    badge: "Azure", badgeClass: "azure", uses: 18,
    tags: ["AKS", "Enterprise"],
    blocks: [
      { label: "AKS", bg: "rgba(0,120,212,0.12)", color: "var(--azure-blue)" },
      { label: "SQL", bg: "rgba(0,120,212,0.12)", color: "var(--azure-blue)" },
      { label: "KV", bg: "rgba(0,120,212,0.12)", color: "var(--azure-blue)" },
      { label: "AG", bg: "rgba(0,120,212,0.12)", color: "var(--azure-blue)" },
    ],
  },
  {
    title: "Multi-Cloud DR Setup",
    desc: "AWS primary + Azure failover. Cross-cloud replication for S3/Blob, coordinated DNS failover.",
    badge: "Multi", badgeClass: "multi", uses: 8,
    tags: ["DR", "Multi-Cloud"],
    blocks: [
      { label: "EKS", bg: "rgba(34,211,238,0.12)", color: "var(--accent-cyan)" },
      { label: "S3", bg: "rgba(16,185,129,0.12)", color: "var(--accent-green)" },
      { label: "Blob", bg: "rgba(0,120,212,0.12)", color: "var(--azure-blue)" },
      { label: "AKS", bg: "rgba(0,120,212,0.12)", color: "var(--azure-blue)" },
    ],
  },
  {
    title: "Shared Services / Landing Zone",
    desc: "VPC + Network Firewall + WAF + CloudTrail + GuardDuty. Foundation layer for multi-env setups.",
    badge: "AWS", badgeClass: "aws", uses: 23,
    tags: ["Security", "Foundation"],
    blocks: [
      { label: "VPC", bg: "rgba(139,92,246,0.12)", color: "var(--accent-purple)" },
      { label: "FW", bg: "rgba(239,68,68,0.12)", color: "var(--accent-red)" },
      { label: "WAF", bg: "rgba(239,68,68,0.12)", color: "var(--accent-red)" },
      { label: "CT", bg: "rgba(255,153,0,0.12)", color: "var(--aws-orange)" },
    ],
  },
]

export default function TemplatesScreen() {
  const [activeFilter, setActiveFilter] = useState("All")

  return (
    <div className="tpl-layout">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Environment Templates</h2>
        <button className="cv-btn cv-btn-primary">+ Create Template</button>
      </div>
      <div className="tpl-filters">
        {FILTERS.map(f => (
          <div
            key={f}
            className={`fchip${activeFilter === f ? " active" : ""}`}
            onClick={() => setActiveFilter(f)}
          >{f}</div>
        ))}
      </div>
      <div className="tpl-grid">
        {TEMPLATES.map((t, i) => (
          <div className="tpl-card" key={i}>
            <div className="tpl-preview">
              {t.blocks.map((b, j) => (
                <div key={j} className="tpl-block" style={{ background: b.bg, color: b.color }}>{b.label}</div>
              ))}
              <div className={`tpl-badge ${t.badgeClass}`}>{t.badge}</div>
            </div>
            <div className="tpl-body">
              <div className="tpl-title">{t.title}</div>
              <div className="tpl-desc">{t.desc}</div>
              <div className="tpl-foot">
                <div className="tpl-tags">{t.tags.map(tag => <span className="tpl-tag" key={tag}>{tag}</span>)}</div>
                <span className="tpl-uses">Used {t.uses}×</span>
              </div>
            </div>
          </div>
        ))}
        <div className="tpl-card tpl-card-empty">
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>+</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Save current environment as template</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Share with your team or across customers</div>
          </div>
        </div>
      </div>
    </div>
  )
}
