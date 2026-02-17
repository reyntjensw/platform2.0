import React from "react"

const STAGES = [
  { name: "Development", dot: "var(--accent-green)", ver: "v2.14.0", deployed: "2h ago", resources: 12, chips: ["EKS 1.29", "RDS", "Redis", "S3 ×3"], newChip: "+2 new" },
  { name: "Acceptance", dot: "var(--accent-orange)", ver: "v2.13.1", deployed: "3 days ago", resources: 10, chips: ["EKS 1.28", "RDS", "Redis", "S3 ×2"], active: true },
  { name: "Production", dot: "var(--accent-red)", ver: "v2.13.0", deployed: "1 week ago", resources: 10, chips: ["EKS 1.28", "RDS", "Redis", "S3 ×2"] },
]

const DIFFS = [
  { type: "add", name: "opensearch-01", desc: "OpenSearch 2.x cluster (r6g.large × 3)" },
  { type: "add", name: "shared-storage", desc: "EFS file system with lifecycle policy" },
  { type: "mod", name: "platform-eks", desc: "Cluster 1.28→1.29, max nodes 8→12" },
]

export default function PromoteScreen() {
  return (
    <div className="promote-layout">
      <h2>Environment Promotion Pipeline</h2>
      <p className="promote-subtitle">Compare, diff, and promote infrastructure changes across environments.</p>

      <div className="pipeline">
        {STAGES.map((s, i) => (
          <React.Fragment key={s.name}>
            {i > 0 && (
              <div className="arrow-col">
                <button
                  className="promote-btn2"
                  style={i === 2 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                  onClick={i === 1 ? () => alert("Promote dev → acc triggered") : undefined}
                >Promote →</button>
                <div className="arrow-line" />
                <span className="arrow-note" style={i === 2 ? { color: "var(--accent-orange)" } : {}}>
                  {i === 1 ? "3 changes" : "needs approval"}
                </span>
              </div>
            )}
            <div className={`stage${s.active ? " active-s" : ""}`}>
              <div className="stage-head">
                <div className="env-dot" style={{ background: s.dot }} />
                <div className="stage-name">{s.name}</div>
                <div className="stage-ver">{s.ver}</div>
              </div>
              <div className="stage-meta">Last deployed: {s.deployed}</div>
              <div className="stage-meta">{s.resources} resources · OpenTofu</div>
              <div className="stage-chips">
                {s.chips.map(c => <span className="chip" key={c}>{c}</span>)}
                {s.newChip && <span className="chip new">{s.newChip}</span>}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="diff-box">
        <div className="diff-head">
          <h3>Diff: Development → Acceptance</h3>
          <div className="diff-stats">
            <span className="a">+2 added</span>
            <span className="m">~1 modified</span>
            <span className="r">-0 removed</span>
          </div>
        </div>
        <div className="diff-body">
          {DIFFS.map((d, i) => (
            <div className={`ditem d${d.type[0]}`} key={i}>
              <span className="dbadge">{d.type}</span>
              <span><strong>{d.name}</strong> — {d.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="cv-btn cv-btn-secondary">Preview Plan</button>
        <button className="cv-btn cv-btn-primary">Approve &amp; Promote to Acceptance</button>
      </div>
    </div>
  )
}
