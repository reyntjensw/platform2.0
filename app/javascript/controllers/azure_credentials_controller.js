import { Controller } from "@hotwired/stimulus"

// Azure credentials management — add, test, list, delete
export default class extends Controller {
    static targets = [
        "overlay", "list",
        // Add form fields
        "addOverlay", "addName", "addTenantId", "addClientId", "addClientSecret",
        "addType", "addExpDate", "addError", "addSaveBtn",
        // Test results
        "testOverlay", "testBody",
        // Delete confirm
        "deleteOverlay", "deleteCredName", "deleteCredId"
    ]
    static values = {
        listUrl: String,
        testUrl: String,
        createUrl: String,
        customerUuid: String,
        projectUuid: String
    }

    connect() {
        this.credentials = []
        this.loadCredentials()
    }

    // ── Data loading ──

    async loadCredentials() {
        try {
            const csrfToken = this.csrfToken()
            const resp = await fetch(this.listUrlValue, {
                headers: { "Accept": "application/json", "X-CSRF-Token": csrfToken }
            })
            const data = await resp.json()
            this.byTenant = data.by_tenant || {}
            this.renderList()
        } catch (e) {
            console.error("Failed to load credentials:", e)
        }
    }

    renderList() {
        if (!this.hasListTarget) return
        const tenantIds = Object.keys(this.byTenant)
        if (tenantIds.length === 0) {
            this.listTarget.innerHTML = ""
            return
        }

        let html = ""
        for (const [tenantId, creds] of Object.entries(this.byTenant)) {
            html += `<div class="card" style="margin-bottom:16px;">
                <div style="padding:10px 16px;background:var(--bg-elevated);border-bottom:1px solid var(--border);font-size:12px;color:var(--text-muted);font-weight:600;">
                    Tenant: <span class="mono" style="font-weight:400;color:var(--text-secondary);">${this.escapeHtml(tenantId)}</span>
                </div>
                <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;">`

            creds.forEach(c => {
                const typeBadge = c.credential_type === "admin"
                    ? '<span class="badge badge-dev">Admin</span>'
                    : '<span class="badge badge-prd">Read-only</span>'
                const expLabel = c.expiration_date
                    ? `<span style="font-size:12px;color:var(--text-muted);">Expires: ${c.expiration_date}</span>`
                    : '<span style="font-size:12px;color:var(--text-muted);">No expiration</span>'
                const name = c.name || c.credential_type || "Credential"

                html += `<div style="border:1px solid var(--border);border-radius:8px;padding:12px 16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-weight:600;font-size:14px;">${this.escapeHtml(name)}</span>
                            ${typeBadge}
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button class="btn btn-ghost btn-sm" style="color:var(--red);font-size:12px;"
                                data-action="click->azure-credentials#openDelete"
                                data-cred-id="${c.credential_id || c.uuid || ''}"
                                data-cred-name="${this.escapeHtml(name)}">Delete</button>
                        </div>
                    </div>
                    <div style="display:flex;gap:20px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);font-size:13px;color:var(--text-muted);">
                        <span>Client: <span class="mono">${this.escapeHtml(c.client_id_masked || (c.client_id || "").substring(0, 8) + "…")}</span></span>
                        ${expLabel}
                        ${this.daysRemainingBadge(c.days_remaining)}
                    </div>
                </div>`
            })

            html += `</div></div>`
        }

        this.listTarget.innerHTML = html
    }

    // ── Add Modal ──

    openAdd() {
        this.addOverlayTarget.classList.add("open")
        document.body.style.overflow = "hidden"
        this.clearAddForm()
    }

    closeAdd() {
        this.addOverlayTarget.classList.remove("open")
        document.body.style.overflow = ""
    }

    clearAddForm() {
        if (this.hasAddNameTarget) this.addNameTarget.value = ""
        if (this.hasAddTenantIdTarget) this.addTenantIdTarget.value = ""
        if (this.hasAddClientIdTarget) this.addClientIdTarget.value = ""
        if (this.hasAddClientSecretTarget) this.addClientSecretTarget.value = ""
        if (this.hasAddExpDateTarget) this.addExpDateTarget.value = ""
        if (this.hasAddErrorTarget) this.addErrorTarget.textContent = ""
        if (this.hasAddSaveBtnTarget) this.addSaveBtnTarget.disabled = false
    }

    async testCredentials() {
        const tenantId = this.addTenantIdTarget.value.trim()
        const clientId = this.addClientIdTarget.value.trim()
        const clientSecret = this.addClientSecretTarget.value.trim()

        if (!tenantId || !clientId || !clientSecret) {
            this.addErrorTarget.textContent = "Tenant ID, Client ID, and Client Secret are required."
            return
        }

        this.addErrorTarget.textContent = ""

        try {
            const resp = await fetch(this.testUrlValue, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRF-Token": this.csrfToken()
                },
                body: JSON.stringify({ tenant_id: tenantId, client_id: clientId, client_secret: clientSecret })
            })
            const data = await resp.json()

            if (resp.ok && data.success) {
                this.showTestResults(true, data.data)
            } else {
                this.showTestResults(false, data.error || "Authentication failed")
            }
        } catch (e) {
            this.showTestResults(false, "Network error")
        }
    }

    showTestResults(success, detail) {
        if (!this.hasTestOverlayTarget) return
        this.testOverlayTarget.classList.add("open")

        if (success) {
            const subs = detail?.subscriptions || detail?.accessible_subscriptions || []
            let subsHtml = ""
            if (Array.isArray(subs) && subs.length > 0) {
                subsHtml = subs.map(s => {
                    const name = s.display_name || s.name || s.subscription_id
                    const id = s.subscription_id || ""
                    return `<div style="padding:8px 12px;border-bottom:1px solid var(--border-light);font-size:13px;">
                        <span style="color:var(--green);margin-right:6px;">✓</span>
                        <span style="font-weight:500;">${this.escapeHtml(name)}</span>
                        <span class="mono" style="color:var(--text-muted);margin-left:6px;font-size:11px;">(${this.escapeHtml(id)})</span>
                    </div>`
                }).join("")
            }
            this.testBodyTarget.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                    <span style="color:var(--green);font-size:18px;">✓</span>
                    <span style="font-weight:600;color:var(--green);">Authentication Successful</span>
                </div>
                ${subsHtml ? `<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Accessible Subscriptions:</div>
                <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">${subsHtml}</div>` : ""}`
        } else {
            this.testBodyTarget.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                    <span style="color:var(--red);font-size:18px;">✗</span>
                    <span style="font-weight:600;color:var(--red);">Authentication Failed</span>
                </div>
                <p style="font-size:13px;color:var(--text-muted);">${this.escapeHtml(String(detail))}</p>`
        }
    }

    closeTest() {
        this.testOverlayTarget.classList.remove("open")
    }

    async saveCredential() {
        const tenantId = this.addTenantIdTarget.value.trim()
        const clientId = this.addClientIdTarget.value.trim()
        const clientSecret = this.addClientSecretTarget.value.trim()

        if (!tenantId || !clientId || !clientSecret) {
            this.addErrorTarget.textContent = "Tenant ID, Client ID, and Client Secret are required."
            return
        }

        this.addSaveBtnTarget.disabled = true
        this.addSaveBtnTarget.textContent = "Saving…"
        this.addErrorTarget.textContent = ""

        const typeSelect = this.addOverlayTarget.querySelector('input[name="credential_type"]:checked')
        const body = {
            tenant_id: tenantId,
            client_id: clientId,
            client_secret: clientSecret,
            credential_type: typeSelect ? typeSelect.value : "read_only",
            name: this.addNameTarget.value.trim() || undefined,
            expiration_date: this.addExpDateTarget.value || undefined
        }

        try {
            const resp = await fetch(this.createUrlValue, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRF-Token": this.csrfToken()
                },
                body: JSON.stringify(body)
            })
            const data = await resp.json()

            if (resp.ok && data.success) {
                this.closeAdd()
                this.loadCredentials()
            } else {
                this.addErrorTarget.textContent = data.error || "Failed to save credential."
                this.addSaveBtnTarget.disabled = false
                this.addSaveBtnTarget.textContent = "Save"
            }
        } catch (e) {
            this.addErrorTarget.textContent = "Network error."
            this.addSaveBtnTarget.disabled = false
            this.addSaveBtnTarget.textContent = "Save"
        }
    }

    // ── Delete Modal ──

    openDelete(event) {
        const btn = event.currentTarget
        this.pendingDeleteId = btn.dataset.credId
        if (this.hasDeleteCredNameTarget) this.deleteCredNameTarget.textContent = btn.dataset.credName || "this credential"
        if (this.hasDeleteCredIdTarget) this.deleteCredIdTarget.value = btn.dataset.credId
        this.deleteOverlayTarget.classList.add("open")
    }

    closeDelete() {
        this.deleteOverlayTarget.classList.remove("open")
    }

    async confirmDelete() {
        if (!this.pendingDeleteId) return

        const url = this.createUrlValue.replace(/\/$/, "") + "/" + this.pendingDeleteId
        try {
            const resp = await fetch(url, {
                method: "DELETE",
                headers: {
                    "Accept": "application/json",
                    "X-CSRF-Token": this.csrfToken()
                }
            })
            if (resp.ok) {
                this.closeDelete()
                this.loadCredentials()
            }
        } catch (e) {
            console.error("Delete failed:", e)
        }
    }

    // ── Helpers ──

    backdropClose(event) {
        if (event.target === event.currentTarget) {
            event.target.classList.remove("open")
            document.body.style.overflow = ""
        }
    }

    closeOnEscape(event) {
        if (event.key === "Escape") {
            this.element.querySelectorAll(".modal-overlay.open").forEach(el => el.classList.remove("open"))
            document.body.style.overflow = ""
        }
    }

    csrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || ""
    }

    escapeHtml(str) {
        const div = document.createElement("div")
        div.textContent = str
        return div.innerHTML
    }

    daysRemainingBadge(days) {
        if (days === null || days === undefined) return ""
        if (days < 0) {
            return `<span class="badge" style="background:var(--red-dim);color:var(--red);">Expired ${Math.abs(days)}d ago</span>`
        }
        if (days <= 30) {
            return `<span class="badge" style="background:var(--orange-dim);color:var(--orange);">${days}d remaining</span>`
        }
        return `<span class="badge" style="background:var(--green-dim);color:var(--green);">${days}d remaining</span>`
    }
}
