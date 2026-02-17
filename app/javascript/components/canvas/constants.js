export const CATEGORY_COLORS = {
    compute: { color: "#ff9900", bg: "rgba(255,153,0,0.12)" },
    database: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    networking: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    storage: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    security: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    monitoring: { color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
    other: { color: "#8b99b5", bg: "rgba(139,153,181,0.12)" },
}

export function catFor(category) {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.other
}

export function csrf() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ""
}
