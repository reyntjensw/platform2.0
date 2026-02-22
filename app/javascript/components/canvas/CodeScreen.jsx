import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { csrf } from "./constants"

/* ── HCL Frontend Validator ── */
function validateHcl(code) {
  const errors = []
  if (!code.trim()) return errors
  const lines = code.split("\n")
  let braces = 0, brackets = 0, parens = 0
  let inString = false, stringChar = null, inBlockComment = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim(), ln = i + 1
    if (!trimmed) continue
    if (inBlockComment) { if (line.indexOf("*/") !== -1) inBlockComment = false; continue }
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue
    if (trimmed.startsWith("/*")) { if (!trimmed.includes("*/")) inBlockComment = true; continue }

    for (let j = 0; j < line.length; j++) {
      const ch = line[j], prev = j > 0 ? line[j - 1] : ""
      if (inString) { if (ch === stringChar && prev !== "\\") inString = false; continue }
      if (ch === "#" || (ch === "/" && line[j + 1] === "/")) break
      if (ch === "/" && line[j + 1] === "*") { inBlockComment = true; break }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue }
      if (ch === "{") braces++; if (ch === "}") braces--
      if (ch === "[") brackets++; if (ch === "]") brackets--
      if (ch === "(") parens++; if (ch === ")") parens--
      if (braces < 0) errors.push({ line: ln, message: "Unexpected closing brace '}'" })
      if (brackets < 0) errors.push({ line: ln, message: "Unexpected closing bracket ']'" })
      if (parens < 0) errors.push({ line: ln, message: "Unexpected closing parenthesis ')'" })
    }
    if (inString) { errors.push({ line: ln, message: "Unclosed string literal" }); inString = false }
  }
  if (braces > 0) errors.push({ line: lines.length, message: `${braces} unclosed brace(s) '{'` })
  if (brackets > 0) errors.push({ line: lines.length, message: `${brackets} unclosed bracket(s) '['` })
  if (parens > 0) errors.push({ line: lines.length, message: `${parens} unclosed parenthesis '('` })
  if (inBlockComment) errors.push({ line: lines.length, message: "Unclosed block comment '/*'" })

  const seen = new Map()
  const namePattern = /^(resource|data|variable|output|module)\s+"([^"]+)"(?:\s+"([^"]+)")?/
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(namePattern)
    if (match) {
      const key = match[3] ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]}.${match[2]}`
      if (seen.has(key)) errors.push({ line: i + 1, message: `Duplicate ${match[1]} "${match[3] || match[2]}" (first on line ${seen.get(key)})` })
      else seen.set(key, i + 1)
    }
  }
  return errors
}

/* ── HCL Syntax Highlighter ── */
const HCL_KEYWORDS = new Set([
  "resource", "data", "variable", "output", "module", "provider", "terraform",
  "locals", "moved", "import", "check"
])
const HCL_BUILTINS = new Set([
  "true", "false", "null", "each", "self", "count", "path", "var", "local",
  "data", "module", "terraform"
])
const HCL_TYPES = new Set([
  "string", "number", "bool", "list", "map", "set", "object", "tuple", "any"
])
const HCL_ATTR_KEYWORDS = new Set([
  "for_each", "count", "depends_on", "lifecycle", "provisioner", "connection",
  "source", "version", "providers", "type", "default", "description",
  "sensitive", "nullable", "validation", "value", "condition", "error_message"
])

function highlightHclLine(line) {
  const parts = []
  let i = 0

  while (i < line.length) {
    // Comments
    if (line[i] === "#" || (line[i] === "/" && line[i + 1] === "/")) {
      parts.push(`<span class="ce-hl-comment">${escHtml(line.slice(i))}</span>`)
      return parts.join("")
    }
    if (line[i] === "/" && line[i + 1] === "*") {
      parts.push(`<span class="ce-hl-comment">${escHtml(line.slice(i))}</span>`)
      return parts.join("")
    }

    // Strings
    if (line[i] === '"') {
      let j = i + 1
      while (j < line.length && !(line[j] === '"' && line[j - 1] !== "\\")) j++
      j = Math.min(j + 1, line.length)
      const str = line.slice(i, j)
      // Highlight interpolations inside strings
      const highlighted = escHtml(str).replace(
        /\$\{([^}]*)\}/g,
        '<span class="ce-hl-interp">${$1}</span>'
      )
      parts.push(`<span class="ce-hl-string">${highlighted}</span>`)
      i = j
      continue
    }

    // Numbers
    if (/\d/.test(line[i]) && (i === 0 || /[\s=\[({,]/.test(line[i - 1]))) {
      let j = i
      while (j < line.length && /[\d.]/.test(line[j])) j++
      parts.push(`<span class="ce-hl-number">${escHtml(line.slice(i, j))}</span>`)
      i = j
      continue
    }

    // Words (keywords, builtins, types, attributes)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++
      const word = line.slice(i, j)
      if (HCL_KEYWORDS.has(word)) {
        parts.push(`<span class="ce-hl-keyword">${escHtml(word)}</span>`)
      } else if (HCL_TYPES.has(word)) {
        parts.push(`<span class="ce-hl-type">${escHtml(word)}</span>`)
      } else if (HCL_ATTR_KEYWORDS.has(word)) {
        parts.push(`<span class="ce-hl-attr">${escHtml(word)}</span>`)
      } else if (HCL_BUILTINS.has(word)) {
        parts.push(`<span class="ce-hl-builtin">${escHtml(word)}</span>`)
      } else {
        // Check if it's followed by ( → function call
        const rest = line.slice(j).trimStart()
        if (rest[0] === "(") {
          parts.push(`<span class="ce-hl-func">${escHtml(word)}</span>`)
        } else {
          parts.push(escHtml(word))
        }
      }
      i = j
      continue
    }

    // Brackets / braces
    if ("{}[]()".includes(line[i])) {
      parts.push(`<span class="ce-hl-bracket">${escHtml(line[i])}</span>`)
      i++
      continue
    }

    // Operators
    if ("=!<>".includes(line[i])) {
      parts.push(`<span class="ce-hl-op">${escHtml(line[i])}</span>`)
      i++
      continue
    }

    parts.push(escHtml(line[i]))
    i++
  }
  return parts.join("")
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function highlightCode(code) {
  return code.split("\n").map(highlightHclLine).join("\n")
}

/* ── Code Editor Panel (for RightPanel) ── */
export default function CodePanel({ environmentId, expanded, onExpandToggle, readOnly }) {
  const [code, setCode] = useState("")
  const [savedCode, setSavedCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [showProblems, setShowProblems] = useState(true)
  const textareaRef = useRef(null)
  const highlightRef = useRef(null)
  const saveTimerRef = useRef(null)

  const apiUrl = `/api/environments/${environmentId}/custom_code`
  const isDirty = code !== savedCode
  const lineCount = Math.max(code.split("\n").length, 15)
  const errorLines = useMemo(() => new Set(errors.map(e => e.line)), [errors])
  const highlighted = useMemo(() => highlightCode(code), [code])

  // Load
  useEffect(() => {
    fetch(apiUrl)
      .then(r => r.json())
      .then(data => { setCode(data.code || ""); setSavedCode(data.code || ""); setLoading(false) })
      .catch(() => setLoading(false))
  }, [apiUrl])

  // Validate on change (debounced)
  useEffect(() => {
    const t = setTimeout(() => setErrors(validateHcl(code)), 300)
    return () => clearTimeout(t)
  }, [code])

  // Auto-save (debounced 1.5s after last keystroke)
  const doSave = useCallback(async (codeToSave) => {
    if (readOnly) return
    setSaving(true)
    try {
      const resp = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({ code: codeToSave, language: "hcl" })
      })
      if (resp.ok) { const d = await resp.json(); setSavedCode(d.code) }
    } finally { setSaving(false) }
  }, [apiUrl, readOnly])

  useEffect(() => {
    if (readOnly || code === savedCode) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => doSave(code), 1500)
    return () => clearTimeout(saveTimerRef.current)
  }, [code, savedCode, doSave, readOnly])

  // Ctrl+S immediate save
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        if (!readOnly && code !== savedCode) { clearTimeout(saveTimerRef.current); doSave(code) }
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [code, savedCode, doSave, readOnly])

  // Tab key
  const handleKeyDown = useCallback((e) => {
    if (readOnly) return
    if (e.key === "Tab") {
      e.preventDefault()
      const ta = e.target, start = ta.selectionStart, end = ta.selectionEnd
      setCode(ta.value.substring(0, start) + "  " + ta.value.substring(end))
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2 })
    }
  }, [readOnly])

  // Sync scroll between textarea and highlight overlay
  const syncScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>Loading…</div>

  return (
    <div className="ce-panel">
      {/* Lock banner when read-only */}
      {readOnly && (
        <div className="ce-lock-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Acquire the canvas lock to edit
        </div>
      )}

      {/* Mini toolbar */}
      <div className="ce-bar">
        <div className="ce-lang-badge">HCL</div>
        <span className="ce-file-label">custom.tf</span>
        {isDirty && !readOnly && <span className="ce-unsaved-dot" />}
        <div style={{ flex: 1 }} />
        {saving && <span className="ce-save-status">Saving…</span>}
        {!saving && !isDirty && savedCode && <span className="ce-save-status saved">✓ Saved</span>}
        <button
          className="ce-validate-btn"
          onClick={() => { setErrors(validateHcl(code)); setShowProblems(true) }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
          Validate
        </button>
        {onExpandToggle && (
          <button className="ce-expand-btn" onClick={onExpandToggle} title={expanded ? "Collapse editor" : "Expand editor"}>
            {expanded ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            )}
          </button>
        )}
      </div>

      {/* Editor with syntax highlight overlay */}
      <div className="ce-editor">
        <div className="ce-gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className={`ce-ln${errorLines.has(i + 1) ? " ce-ln-err" : ""}`}>{i + 1}</div>
          ))}
        </div>
        <div className="ce-editor-wrap">
          <pre
            ref={highlightRef}
            className="ce-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
          />
          <textarea
            ref={textareaRef}
            className="ce-textarea"
            value={code}
            onChange={readOnly ? undefined : (e => setCode(e.target.value))}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            readOnly={readOnly}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder={readOnly ? "" : "# Custom HCL for this environment\n# Appended to generated config\n\n# resource \"aws_s3_bucket\" \"custom\" {\n#   bucket = \"my-bucket\"\n# }"}
          />
        </div>
      </div>

      {/* Problems */}
      {showProblems && (
        <div className="ce-problems">
          <div className="ce-prob-head">
            <span>Problems</span>
            {errors.length > 0 && <span className="ce-prob-count">{errors.length}</span>}
            {errors.length === 0 && <span className="ce-prob-ok">✓</span>}
            <div style={{ flex: 1 }} />
            <button className="ce-prob-close" onClick={() => setShowProblems(false)}>×</button>
          </div>
          <div className="ce-prob-body">
            {errors.length === 0 ? (
              <div className="ce-prob-empty">No problems detected</div>
            ) : errors.map((err, i) => (
              <div key={i} className="ce-prob-row" onClick={() => {
                if (!textareaRef.current) return
                const lines = code.split("\n")
                let pos = 0
                for (let l = 0; l < err.line - 1 && l < lines.length; l++) pos += lines[l].length + 1
                textareaRef.current.focus()
                textareaRef.current.setSelectionRange(pos, pos + (lines[err.line - 1]?.length || 0))
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span className="ce-prob-msg">{err.message}</span>
                <span className="ce-prob-loc">Ln {err.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="ce-statusbar">
        <span>HCL</span>
        <span>{code.length} chars</span>
        {readOnly && <span style={{ color: "var(--text-muted)" }}>🔒 Read-only</span>}
        {!readOnly && isDirty && <span style={{ color: "var(--orange)" }}>● Modified</span>}
      </div>
    </div>
  )
}
