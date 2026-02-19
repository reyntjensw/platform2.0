import { useState } from 'react'

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function GlobalMonthSelector({ year, month, onChange }) {
  const goToPrev = () => month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1)
  const goToNext = () => {
    if (year === CURRENT_YEAR && month >= CURRENT_MONTH) return
    month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1)
  }
  const isCurrent = year === CURRENT_YEAR && month === CURRENT_MONTH

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '4px 8px', border: '1px solid var(--border)' }}>
      <button onClick={goToPrev} aria-label="Previous month" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'var(--bg-input)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}>‹</button>
      <div style={{ minWidth: 90, textAlign: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{MONTH_NAMES[month - 1]} {year}</span>
      </div>
      <button onClick={goToNext} disabled={isCurrent} aria-label="Next month" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: isCurrent ? 'transparent' : 'var(--bg-input)', border: 'none', color: isCurrent ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: isCurrent ? 'default' : 'pointer', borderRadius: 'var(--radius-sm)' }}>›</button>
    </div>
  )
}
