import { useState, useMemo } from 'react'

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_SCORES = {
  overall: 62, grade: 'C',
  previous: 58, delta: 4,
  pillars: [
    { key: 'security',       label: 'Security',       score: 44, color: 'var(--red)' },
    { key: 'reliability',    label: 'Reliability',     score: 78, color: 'var(--green)' },
    { key: 'performance',    label: 'Performance',     score: 71, color: 'var(--azure)' },
    { key: 'cost',           label: 'Cost',            score: 55, color: 'var(--amber)' },
    { key: 'operations',     label: 'Operations',      score: 68, color: '#a78bfa' },
    { key: 'sustainability', label: 'Sustainability',  score: 59, color: '#34d399' },
  ],
}

const DEMO_SCAN = { lastScan: '2 hours ago', checksRun: 147, criticalFindings: 3, passed: 89, provider: 'AWS', region: 'eu-west-1' }

const PILLAR_WIDGETS = [
  {
    key: 'security', num: '01', label: 'Security', score: 44, scoreClass: 'low',
    accent: 'wa-security', icon: 'wi-red',
    findings: [{ cls: 'fc-crit', text: '3 Critical' }, { cls: 'fc-high', text: '4 High' }, { cls: 'fc-med', text: '2 Medium' }],
    checks: [
      { status: 'fail', label: 'IAM root account usage', count: '3 issues', color: 'var(--red)' },
      { status: 'fail', label: 'MFA not enforced', count: '5 users', color: 'var(--red)' },
      { status: 'warn', label: 'Security groups too open', count: '2 groups', color: 'var(--amber)' },
      { status: 'pass', label: 'CloudTrail enabled', count: '✓ Pass', color: 'var(--green)' },
    ],
  },
  {
    key: 'reliability', num: '02', label: 'Reliability', score: 78, scoreClass: 'high',
    accent: 'wa-reliability', icon: 'wi-green',
    findings: [{ cls: 'fc-high', text: '1 High' }, { cls: 'fc-med', text: '2 Medium' }, { cls: 'fc-low', text: '12 Passed' }],
    checks: [
      { status: 'warn', label: 'No multi-AZ on RDS', count: '1 instance', color: 'var(--amber)' },
      { status: 'pass', label: 'Auto scaling configured', count: '✓ Pass', color: 'var(--green)' },
      { status: 'pass', label: 'Health checks enabled', count: '✓ Pass', color: 'var(--green)' },
      { status: 'pass', label: 'Backup policies set', count: '✓ Pass', color: 'var(--green)' },
    ],
  },
  {
    key: 'performance', num: '03', label: 'Performance', score: 71, scoreClass: 'high',
    accent: 'wa-performance', icon: 'wi-blue',
    findings: [{ cls: 'fc-high', text: '2 High' }, { cls: 'fc-med', text: '3 Medium' }, { cls: 'fc-low', text: '9 Passed' }],
    checks: [
      { status: 'warn', label: 'Over-provisioned EC2 instances', count: '4 instances', color: 'var(--amber)' },
      { status: 'warn', label: 'No CDN for static assets', count: '2 buckets', color: 'var(--amber)' },
      { status: 'pass', label: 'Caching enabled on ALB', count: '✓ Pass', color: 'var(--green)' },
      { status: 'pass', label: 'ARM instances used where possible', count: '✓ Pass', color: 'var(--green)' },
    ],
  },
  {
    key: 'cost', num: '04', label: 'Cost Optimization', score: 55, scoreClass: 'med',
    accent: 'wa-cost', icon: 'wi-amber',
    findings: [{ cls: 'fc-high', text: '3 High' }, { cls: 'fc-med', text: '5 Medium' }, { cls: 'fc-low', text: '7 Passed' }],
    checks: [
      { status: 'fail', label: 'Unattached EBS volumes', count: '8 volumes', color: 'var(--red)' },
      { status: 'warn', label: 'No Reserved Instances', count: '~€340/mo', color: 'var(--amber)' },
      { status: 'warn', label: 'S3 lifecycle policies missing', count: '3 buckets', color: 'var(--amber)' },
      { status: 'pass', label: 'Cost allocation tags set', count: '✓ Pass', color: 'var(--green)' },
    ],
  },
  {
    key: 'operations', num: '05', label: 'Operational Excellence', score: 68, scoreClass: 'high',
    accent: 'wa-ops', icon: 'wi-purple',
    findings: [{ cls: 'fc-high', text: '2 High' }, { cls: 'fc-med', text: '3 Medium' }, { cls: 'fc-low', text: '10 Passed' }],
    checks: [
      { status: 'warn', label: 'No runbooks in Systems Manager', count: 'Missing', color: 'var(--amber)' },
      { status: 'warn', label: 'CloudWatch alarms incomplete', count: '6 gaps', color: 'var(--amber)' },
      { status: 'pass', label: 'IaC deployed via pipeline', count: '✓ Pass', color: 'var(--green)' },
      { status: 'pass', label: 'Tagging strategy in place', count: '✓ Pass', color: 'var(--green)' },
    ],
  },
  {
    key: 'sustainability', num: '06', label: 'Sustainability', score: 59, scoreClass: 'med',
    accent: 'wa-sustain', icon: 'wi-teal',
    findings: [{ cls: 'fc-high', text: '1 High' }, { cls: 'fc-med', text: '4 Medium' }, { cls: 'fc-low', text: '8 Passed' }],
    checks: [
      { status: 'warn', label: 'No Graviton instances used', count: '7 eligible', color: 'var(--amber)' },
      { status: 'warn', label: 'Region not carbon-optimised', count: 'eu-west-1', color: 'var(--amber)' },
      { status: 'pass', label: 'Serverless functions used', count: '✓ Pass', color: 'var(--green)' },
      { status: 'pass', label: 'S3 Intelligent-Tiering active', count: '✓ Pass', color: 'var(--green)' },
    ],
  },
]

const DEMO_FINDINGS = [
  {
    severity: 'critical', pillar: 'security', pillarClass: 'ft-security',
    title: 'Root account has active access keys',
    desc: 'The AWS root account has programmatic access keys enabled. This is a critical risk — if these keys are compromised the attacker gains unrestricted access to your entire AWS account.',
    resource: 'Account', resourceId: '123456789012', effort: 'low',
    steps: [
      'Sign in to the AWS console as the root user and navigate to <strong>IAM → Security credentials</strong>.',
      'Under <em>Access keys</em>, click <strong>Delete</strong> for all existing root access keys.',
      'Enable MFA on the root account immediately. Use a hardware token (YubiKey) or virtual MFA app.',
      'Create an IAM user with <code>AdministratorAccess</code> policy for day-to-day admin tasks.',
    ],
  },
  {
    severity: 'critical', pillar: 'security', pillarClass: 'ft-security',
    title: 'MFA not enabled for 5 IAM users',
    desc: '5 IAM users with console access do not have multi-factor authentication enabled. Without MFA, a leaked password is enough to fully compromise these accounts.',
    resource: 'IAM', resourceId: '5 users', effort: 'low',
    steps: [
      'Go to <strong>IAM → Users</strong> and filter by <em>MFA not enabled</em>. Affected: <code>deploy-ci</code>, <code>dev-john</code>, <code>dev-lisa</code>, <code>ops-mark</code>, <code>svc-backup</code>.',
      'For human users, assign a virtual MFA device via your internal identity system.',
      'For service accounts like <code>deploy-ci</code>, disable console access entirely.',
      'Attach an IAM policy that denies all actions unless MFA is present using <code>aws:MultiFactorAuthPresent</code>.',
    ],
  },
  {
    severity: 'critical', pillar: 'security', pillarClass: 'ft-security',
    title: 'Security group allows 0.0.0.0/0 on port 22 (SSH)',
    desc: 'Security group sg-0abc123 attached to 3 EC2 instances exposes SSH (port 22) to the entire internet, allowing brute-force attacks.',
    resource: 'EC2', resourceId: 'sg-0abc123', effort: 'low',
    steps: [
      'In <strong>EC2 → Security Groups → sg-0abc123</strong>, edit inbound rules and remove the <code>0.0.0.0/0</code> rule on port 22.',
      'Replace with your office/VPN IP range only, or use AWS Systems Manager Session Manager instead.',
      'Enable <strong>AWS Config rule</strong> <code>restricted-ssh</code> to alert on future public SSH exposure.',
      'Consider deploying a bastion host or AWS SSM for all future SSH needs.',
    ],
  },
  {
    severity: 'high', pillar: 'cost', pillarClass: 'ft-cost',
    title: '8 unattached EBS volumes incurring cost',
    desc: '8 EBS volumes are not attached to any EC2 instance and have not been used in over 30 days, costing approximately €68/month.',
    resource: 'EC2 / EBS', resourceId: '8 volumes', effort: 'low',
    steps: [
      'In <strong>EC2 → Volumes</strong>, filter by state <code>available</code>. Review each volume.',
      'Create a snapshot of each volume before deletion: <code>aws ec2 create-snapshot --volume-id vol-xxx</code>.',
      'Delete the volumes once snapshots are confirmed.',
      'Enable <strong>AWS Config rule</strong> <code>ec2-volume-inuse-check</code> to prevent future accumulation.',
    ],
  },
  {
    severity: 'high', pillar: 'reliability', pillarClass: 'ft-reliability',
    title: 'RDS instance not deployed in Multi-AZ',
    desc: 'The production RDS instance db-prod-postgres-01 is running in a single AZ. An AZ outage would cause 20–30 minutes of database downtime.',
    resource: 'RDS', resourceId: 'db-prod-postgres-01', effort: 'med',
    steps: [
      'In <strong>RDS → Databases → db-prod-postgres-01</strong>, click <strong>Modify</strong> and enable <em>Multi-AZ deployment</em>.',
      'Schedule during a maintenance window — enabling Multi-AZ causes ~60 seconds of downtime.',
      'After enabling, verify the standby replica is in a different AZ via the <em>Secondary AZ</em> field.',
    ],
  },
  {
    severity: 'high', pillar: 'performance', pillarClass: 'ft-performance',
    title: '4 EC2 instances significantly over-provisioned',
    desc: '4 EC2 instances (t3.2xlarge) are running at under 8% CPU and 12% memory. Rightsizing to t3.medium would save ~€340/month.',
    resource: 'EC2', resourceId: '4 instances', effort: 'med',
    extraPillar: { label: 'Cost', cls: 'ft-cost' },
    steps: [
      'Review the Rightsizing recommendations in the <strong>Factor Fifty Rightsizing</strong> dashboard.',
      'Stop each instance and change type to <code>t3.medium</code> via <strong>EC2 → Actions → Instance settings</strong>.',
      'Monitor CPU, memory and network for 48 hours after resize.',
      'Consider purchasing Reserved Instances or Savings Plans for additional 30–40% savings.',
    ],
  },
]

// ── PDF Export ──────────────────────────────────────────────────────────────────
function exportSecurityPdf(scores, scan, pillars, findings, envName) {
  const bars = [6,8,10,12,14,16,18,20].map(h =>
    `<span style="display:inline-block;width:3px;height:${h}px;background:#2ecc71;border-radius:1px;margin-right:2px;vertical-align:bottom"></span>`
  ).join('')

  const gradeColor = scores.overall >= 70 ? '#4ade80' : scores.overall >= 50 ? '#fbbf24' : '#f87171'

  const pillarRows = scores.pillars.map(p => {
    const barColor = p.color.startsWith('var(') ? (
      p.color.includes('red') ? '#f87171' :
      p.color.includes('green') ? '#4ade80' :
      p.color.includes('azure') ? '#60a5fa' :
      p.color.includes('amber') ? '#fbbf24' : p.color.replace('var(--', '').replace(')', '')
    ) : p.color
    return `<tr>
      <td style="padding:6px 10px;font-size:12px;font-weight:600">${p.label}</td>
      <td style="padding:6px 10px;width:200px">
        <div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${p.score}%;background:${barColor};border-radius:3px"></div>
        </div>
      </td>
      <td style="padding:6px 10px;font-family:monospace;font-size:12px;font-weight:700;color:${barColor}">${p.score}/100</td>
    </tr>`
  }).join('')

  const pillarChecks = pillars.map(p => {
    const checkRows = p.checks.map(c => {
      const dotColor = c.status === 'pass' ? '#4ade80' : c.status === 'fail' ? '#f87171' : '#fbbf24'
      return `<tr>
        <td style="padding:4px 10px;font-size:11px">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};margin-right:6px;vertical-align:middle"></span>
          ${c.label}
        </td>
        <td style="padding:4px 10px;font-size:11px;text-align:right;font-family:monospace;color:${dotColor === '#4ade80' ? '#16a34a' : dotColor === '#f87171' ? '#dc2626' : '#d97706'}">${c.count}</td>
      </tr>`
    }).join('')
    return `<div style="margin-bottom:16px">
      <h3 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#374151">Pillar ${p.num} — ${p.label} <span style="font-family:monospace;font-weight:400;color:#6b7280">(${p.score}/100)</span></h3>
      <table style="width:100%;border-collapse:collapse">${checkRows}</table>
    </div>`
  }).join('')

  const findingRows = findings.map((f, i) => {
    const sevColor = f.severity === 'critical' ? '#dc2626' : f.severity === 'high' ? '#ea580c' : f.severity === 'medium' ? '#d97706' : '#16a34a'
    const sevBg = f.severity === 'critical' ? '#fef2f2' : f.severity === 'high' ? '#fff7ed' : f.severity === 'medium' ? '#fffbeb' : '#f0fdf4'
    const stepsHtml = f.steps.map((s, j) =>
      `<div style="display:flex;gap:8px;margin-bottom:4px;font-size:11px;color:#374151;line-height:1.5">
        <span style="font-family:monospace;font-size:9px;font-weight:700;width:16px;height:16px;border-radius:3px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${j + 1}</span>
        <span>${s}</span>
      </div>`
    ).join('')
    return `<div style="padding:14px 0;border-bottom:1px solid #e5e7eb">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <span style="font-family:monospace;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${sevBg};color:${sevColor};white-space:nowrap;border:1px solid ${sevColor}20">● ${f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;margin-bottom:3px">${f.title} <span style="font-family:monospace;font-size:9px;padding:1px 5px;border-radius:3px;background:#f3f4f6;color:#6b7280">${f.pillar}</span></div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:8px">${f.desc}</div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px">
            <div style="font-family:monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px">Remediation</div>
            ${stepsHtml}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;min-width:90px">
          <div style="font-family:monospace;font-size:10px;color:#9ca3af">${f.resource}</div>
          <div style="font-family:monospace;font-size:10px;color:#6b7280">${f.resourceId}</div>
        </div>
      </div>
    </div>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><title>Security Dashboard — Factor Fifty</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;margin:0;color:#1a1a1a}
      table{border-collapse:collapse;width:100%}
      @media print{.no-print{display:none}}
      @page{margin:16mm 12mm}
    </style>
  </head><body>
    <div style="padding:24px 32px 16px;border-bottom:2px solid #2ecc71;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:flex-end">${bars}</div>
        <span style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1a1a">Factor Fifty</span>
      </div>
      <div style="text-align:right;font-size:11px;color:#888">
        <div>Security Dashboard Report</div>
        <div>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
    <div style="padding:24px 32px">
      <h1 style="font-size:20px;margin:0 0 4px;font-weight:700">Security Dashboard</h1>
      <p style="color:#888;font-size:12px;margin:0 0 20px">${envName || 'Environment'} · ${scan.provider} · ${scan.region} · ${scan.checksRun} checks</p>

      <div style="display:flex;align-items:center;gap:24px;padding:16px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px">
        <div>
          <div style="font-family:monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px">Overall WAF Score</div>
          <div style="font-family:monospace;font-size:42px;font-weight:700;color:${gradeColor};line-height:1">${scores.overall}</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px">Grade ${scores.grade} · Previous: ${scores.previous}</div>
        </div>
        <div style="width:1px;height:50px;background:#e5e7eb"></div>
        <table style="flex:1"><tbody>${pillarRows}</tbody></table>
      </div>

      <h2 style="font-size:15px;font-weight:700;margin:0 0 12px">Pillar Breakdown</h2>
      ${pillarChecks}

      <h2 style="font-size:15px;font-weight:700;margin:24px 0 12px">Findings & Remediation (${findings.length})</h2>
      ${findingRows}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #eee;font-size:10px;color:#aaa;display:flex;justify-content:space-between">
      <span>Generated by Factor Fifty</span><span>Confidential</span>
    </div>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// ── Score Ring ──────────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 22 // ~138.2
function ScoreRing({ score, size = 54 }) {
  const cls = score >= 70 ? 'high' : score >= 50 ? 'med' : 'low'
  const offset = CIRC - (score / 100) * CIRC
  return (
    <div className={`sec-score-ring-wrap score-${cls}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
        <circle className="sec-score-ring-bg" cx="27" cy="27" r="22" />
        <circle className="sec-score-ring-fill" cx="27" cy="27" r="22"
          strokeDasharray={CIRC} strokeDashoffset={offset} />
      </svg>
      <div className="sec-score-ring-text">
        <span className="sec-score-ring-val">{score}</span>
        <span className="sec-score-ring-pct">/100</span>
      </div>
    </div>
  )
}

// ── Pillar Widget ──────────────────────────────────────────────────────────────
function PillarWidget({ pillar }) {
  return (
    <div className="sec-waf-widget">
      <div className={`sec-widget-accent ${pillar.accent}`} />
      <div className="sec-widget-body">
        <div className="sec-widget-header">
          <div>
            <div className="sec-widget-pillar">Pillar {pillar.num}</div>
            <div className="sec-widget-name">{pillar.label}</div>
          </div>
          <ScoreRing score={pillar.score} />
        </div>
        <div className="sec-widget-findings">
          {pillar.findings.map((f, i) => (
            <div key={i} className={`sec-finding-chip ${f.cls}`}>{f.text}</div>
          ))}
        </div>
        <div className="sec-widget-checks">
          {pillar.checks.map((c, i) => (
            <div key={i} className="sec-wcheck">
              <div className={`sec-wcheck-dot ${c.status}`} />
              <div className="sec-wcheck-label">{c.label}</div>
              <div className="sec-wcheck-count" style={{ color: c.color }}>{c.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Scan Meta Bar ──────────────────────────────────────────────────────────────
function ScanBar({ scan }) {
  const items = [
    { icon: 'clock', label: 'Last scan:', value: scan.lastScan },
    { icon: 'activity', label: 'Checks run:', value: scan.checksRun },
    { icon: 'alert', label: 'Findings:', value: `${scan.criticalFindings} critical`, valueColor: 'var(--red)' },
    { icon: 'check', label: 'Passed:', value: `${scan.passed} checks`, valueColor: 'var(--green)' },
    { icon: 'server', label: 'Provider:', value: `${scan.provider} · ${scan.region}` },
  ]
  return (
    <div className="sec-scan-bar">
      <div className="sec-scan-meta">
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <div className="sec-scan-divider" />}
            <div className="sec-scan-item">
              <span>{item.label}</span>
              <span style={{ color: item.valueColor || 'var(--text-dim)', fontWeight: 500 }}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Score Banner ───────────────────────────────────────────────────────────────
function ScoreBanner({ scores }) {
  const gradeColor = scores.overall >= 70 ? 'var(--green)' : scores.overall >= 50 ? 'var(--amber)' : 'var(--red)'
  const gradeBg = scores.overall >= 70 ? 'var(--green-dim)' : scores.overall >= 50 ? 'var(--amber-dim)' : 'var(--red-dim)'
  return (
    <div className="sec-score-banner">
      <div className="sec-score-banner-main">
        <div>
          <div className="sec-score-banner-label">Overall WAF Score</div>
          <div className="sec-score-big" style={{ color: gradeColor }}>{scores.overall}</div>
          <div className="sec-score-big-sub">out of 100 · Needs improvement</div>
          <div className="sec-score-big-grade" style={{ background: gradeBg, color: gradeColor, borderColor: gradeColor }}>
            Grade {scores.grade}
          </div>
        </div>
        <div className="sec-score-divider" />
        <div className="sec-score-breakdown">
          {scores.pillars.map((p) => (
            <div key={p.key} className="sec-sb-item">
              <div className="sec-sb-label">{p.label}</div>
              <div className="sec-sb-bar-wrap">
                <div className="sec-sb-bar" style={{ width: `${p.score}%`, background: p.color }} />
              </div>
              <div className="sec-sb-val" style={{ color: p.color }}>{p.score}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sec-score-banner-right">
        <div className="sec-last-scan">Previous score: <span>{scores.previous}</span></div>
        <div className={`sec-trend-pill ${scores.delta > 0 ? 'trend-up' : 'trend-down'}`}>
          {scores.delta > 0 ? '↑' : '↓'} {Math.abs(scores.delta)} pts since last scan
        </div>
      </div>
    </div>
  )
}

// ── Finding Row ────────────────────────────────────────────────────────────────
function FindingRow({ finding }) {
  const sevClass = `sev-${finding.severity}`
  const sevLabel = finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)
  const effortClass = finding.effort === 'low' ? 'effort-low' : finding.effort === 'med' ? 'effort-med' : 'effort-high'
  const effortLabel = finding.effort === 'low' ? '⚡ Low effort' : finding.effort === 'med' ? '⏱ Medium effort' : '🔧 High effort'

  return (
    <tr>
      <td colSpan={3}>
        <div className="sec-finding-row">
          <div className="sec-finding-sev">
            <span className={`sec-sev-badge ${sevClass}`}>● {sevLabel}</span>
          </div>
          <div className="sec-finding-main">
            <div className="sec-finding-title">
              {finding.title}
              <span className={`sec-finding-pillar-tag ${finding.pillarClass}`}>{finding.pillar.charAt(0).toUpperCase() + finding.pillar.slice(1)}</span>
              {finding.extraPillar && (
                <span className={`sec-finding-pillar-tag ${finding.extraPillar.cls}`}>{finding.extraPillar.label}</span>
              )}
            </div>
            <div className="sec-finding-desc">{finding.desc}</div>
            <div className="sec-remediation">
              <div className="sec-remediation-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
                  <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Remediation
              </div>
              <div className="sec-remediation-steps">
                {finding.steps.map((step, i) => (
                  <div key={i} className="sec-rem-step">
                    <div className="sec-rem-step-num">{i + 1}</div>
                    <div dangerouslySetInnerHTML={{ __html: step }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="sec-finding-meta">
            <div className="sec-finding-resource">{finding.resource}<br /><span>{finding.resourceId}</span></div>
            <div className={`sec-finding-effort ${effortClass}`}>{effortLabel}</div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Findings Table ─────────────────────────────────────────────────────────────
function FindingsTable({ findings }) {
  const [filter, setFilter] = useState('critical')
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, all: 0 }
    findings.forEach((f) => { c[f.severity] = (c[f.severity] || 0) + 1; c.all++ })
    return c
  }, [findings])

  const filtered = filter === 'all' ? findings : findings.filter((f) => f.severity === filter)

  const pills = [
    { key: 'critical', label: `● Critical (${counts.critical})`, cls: 'f-crit' },
    { key: 'high', label: `High (${counts.high})`, cls: 'f-high' },
    { key: 'medium', label: `Medium (${counts.medium || 0})`, cls: '' },
    { key: 'all', label: 'All', cls: '' },
  ]

  return (
    <>
      <div className="sec-section-header">
        <div className="sec-section-title-row">
          <div className="sec-section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <div className="sec-section-title">Findings & Remediation Steps</div>
            <div className="sec-section-sub">Prioritised issues with step-by-step remediation guidance</div>
          </div>
        </div>
        <div className="sec-findings-filters">
          {pills.map((p) => (
            <button key={p.key}
              className={`sec-filter-pill ${p.cls} ${filter === p.key ? 'active' : ''}`}
              onClick={() => setFilter(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="sec-table-card">
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Finding</th>
              <th>Resource</th>
              <th>Effort</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => <FindingRow key={i} finding={f} />)}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SecurityDashboard({ environmentName, customerName, projectName }) {
  return (
    <div className="sec-page">
      <div className="sec-page-header">
        <div>
          <div className="sec-page-title">
            <div className="sec-page-title-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            Security Dashboard
            <span className="sec-beta-badge">Beta</span>
          </div>
          <div className="sec-page-sub">
            AWS Well-Architected Framework assessment for environment <strong style={{ color: 'var(--text-dim)' }}>{environmentName || 'Production'}</strong> · {DEMO_SCAN.checksRun} checks across 6 pillars
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="context-pill">
            <div className="context-dot" />
            {projectName || 'Project'} · {environmentName || 'Environment'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => exportSecurityPdf(DEMO_SCORES, DEMO_SCAN, PILLAR_WIDGETS, DEMO_FINDINGS, environmentName || 'Production')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export PDF
          </button>
          <button className="btn btn-green btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Re-scan
          </button>
        </div>
      </div>

      <ScanBar scan={DEMO_SCAN} />
      <ScoreBanner scores={DEMO_SCORES} />

      <div className="sec-widgets-grid">
        {PILLAR_WIDGETS.map((p) => <PillarWidget key={p.key} pillar={p} />)}
      </div>

      <FindingsTable findings={DEMO_FINDINGS} />
    </div>
  )
}
