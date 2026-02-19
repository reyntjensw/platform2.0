import { Controller } from "@hotwired/stimulus"

// 2-step Azure environment onboarding modal.
// Step 1: Select admin + read-only credentials, pick subscription, enter env name → Validate
// Step 2: SLA, Integrations (FinOps, SecOps, Monitoring auto-set by SLA) → Save
export default class extends Controller {
    static targets = [
        "overlay", "step1", "step2", "stepIndicator",
        "noCreds", "credsForm",
        "adminCred", "readOnlyCred", "subscription", "environmentName",
        "validateBtn", "validateError",
        "sla", "finops", "secops", "monitoring", "monitoringNote"
    ]
    static values = {
        credentialsUrl: String,
        testUrl: String,
        createUrl: String,
        customerUuid: String,
        projectUuid: String
    }

    connect() {
        this.byTenant = {}
        this.adminCreds = []
        this.readOnlyCreds = []
    }

    async open() {
        this.resetForm()
        this.overlayTarget.classList.add("open")
        document.body.style.overflow = "hidden"
        await this.loadCredentials()
    }

    close() {
        this.overlayTarget.classList.remove("open")
        document.body.style.overflow = ""
    }

    backdropClose(event) {
        if (event.target === this.overlayTarget) this.close()
    }

    closeOnEscape(event) {
        if (event.key === "Escape") this.close()
    }

    // ── Credential loading ──

    async loadCredentials() {
        try {
            const resp = await fetch(this.credentialsUrlValue, {
                headers: { "Accept": "application/json", "X-CSRF-Token": this.csrfToken() }
            })
            const data = await resp.json()
            this.byTenant = data.by_tenant || {}

            // Flatten all credentials and split by type
            this.adminCreds = []
            this.readOnlyCreds = []
            for (const [tenantId, creds] of Object.entries(this.byTenant)) {
                for (const c of creds) {
                    const item = { ...c, tenant_id: tenantId }
                    if (c.credential_type === "admin") this.adminCreds.push(item)
                    else this.readOnlyCreds.push(item)
                }
            }

            const hasReadOnly = this.readOnlyCreds.length > 0

            if (!hasReadOnly) {
                this.noCredsTarget.style.display = "block"
                this.credsFormTarget.style.display = "none"
                this.noCredsTarget.innerHTML = `
                    <div style="text-align:center;padding:20px 0;">
                        <span style="font-size:32px;">🔑</span>
                        <p style="font-size:14px;font-weight:600;margin:12px 0 6px;">Missing credentials</p>
                        <p style="font-size:13px;color:var(--text-secondary);">
                            You need at least a <span style="font-weight:600;">Read-only</span> credential before adding an environment.
                        </p>
                        <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">
                            Go to the <span style="font-weight:600;">Credentials</span> tab to add one first.
                        </p>
                    </div>`
                return
            }

            this.noCredsTarget.style.display = "none"
            this.credsFormTarget.style.display = "block"
            this.populateCredSelects()
        } catch (e) {
            console.error("Failed to load credentials:", e)
        }
    }

    populateCredSelects() {
        // Admin select (optional)
        this.adminCredTarget.textContent = ""
        const noneOpt = document.createElement("option")
        noneOpt.value = ""
        noneOpt.textContent = "None (optional)"
        this.adminCredTarget.appendChild(noneOpt)
        this.adminCreds.forEach(c => {
            const label = c.name || `Admin (${(c.client_id_masked || "").substring(0, 12)}…)`
            const opt = document.createElement("option")
            opt.value = c.credential_id
            opt.dataset.tenant = c.tenant_id
            opt.textContent = label
            this.adminCredTarget.appendChild(opt)
        })

        // Read-only select
        this.readOnlyCredTarget.textContent = ""
        const roPlaceholder = document.createElement("option")
        roPlaceholder.value = ""
        roPlaceholder.textContent = "Select read-only credential…"
        this.readOnlyCredTarget.appendChild(roPlaceholder)
        this.readOnlyCreds.forEach(c => {
            const label = c.name || `Read-only (${(c.client_id_masked || "").substring(0, 12)}…)`
            const opt = document.createElement("option")
            opt.value = c.credential_id
            opt.dataset.tenant = c.tenant_id
            opt.textContent = label
            this.readOnlyCredTarget.appendChild(opt)
        })

        // Subscription starts empty
    }

    async adminCredChanged() {
        // If both selected, validate tenants match
        this.validateTenantMatch()
    }

    async readOnlyCredChanged() {
        this.validateTenantMatch()
    }

    validateTenantMatch() {
        const adminId = this.adminCredTarget.value
        const roId = this.readOnlyCredTarget.value
        if (adminId && roId) {
            const adminTenant = this.adminCredTarget.selectedOptions[0]?.dataset?.tenant
            const roTenant = this.readOnlyCredTarget.selectedOptions[0]?.dataset?.tenant
            if (adminTenant !== roTenant) {
                this.validateErrorTarget.textContent = "Admin and Read-only credentials must belong to the same tenant."
                return
            }
        }
        this.validateErrorTarget.textContent = ""
    }

    // ── Step navigation ──

    resetForm() {
        this.showStep(1)
        if (this.hasValidateErrorTarget) this.validateErrorTarget.textContent = ""
        if (this.hasValidateBtnTarget) {
            this.validateBtnTarget.disabled = false
            this.validateBtnTarget.textContent = "Validate"
        }
        if (this.hasEnvironmentNameTarget) this.environmentNameTarget.value = ""
    }

    showStep(num) {
        this.step1Target.style.display = num === 1 ? "block" : "none"
        this.step2Target.style.display = num === 2 ? "block" : "none"
        this.stepIndicatorTarget.innerHTML = this.buildStepIndicator(num)
    }

    buildStepIndicator(current) {
        const num = parseInt(current, 10) || 1
        const s1Active = num >= 1
        const s2Active = num >= 2
        const lineColor = s2Active ? "var(--green)" : "var(--border)"
        return `
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 0;">
                <span style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
                    background:${s1Active ? 'var(--green)' : 'var(--bg-input)'};color:${s1Active ? 'white' : 'var(--text-muted)'};">1</span>
                <span style="width:40px;height:2px;background:${lineColor};"></span>
                <span style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
                    background:${s2Active ? 'var(--green)' : 'var(--bg-input)'};color:${s2Active ? 'white' : 'var(--text-muted)'};">2</span>
                <span style="margin-left:8px;font-size:12px;color:var(--text-secondary);">Step ${current} of 2</span>
            </div>`
    }

    // ── Validate (step 1 → step 2) ──

    async validate() {
        const roId = this.readOnlyCredTarget.value
        const subId = this.subscriptionTarget.value.trim()
        const envName = this.environmentNameTarget.value.trim()

        if (!envName) {
            this.validateErrorTarget.textContent = "Environment name is required."
            return
        }
        if (!roId) {
            this.validateErrorTarget.textContent = "Select a Read-only credential."
            return
        }
        if (!subId) {
            this.validateErrorTarget.textContent = "Subscription ID is required."
            return
        }

        // If admin is selected, verify tenants match
        const adminId = this.adminCredTarget.value
        if (adminId) {
            const adminTenant = this.adminCredTarget.selectedOptions[0]?.dataset?.tenant
            const roTenant = this.readOnlyCredTarget.selectedOptions[0]?.dataset?.tenant
            if (adminTenant !== roTenant) {
                this.validateErrorTarget.textContent = "Admin and Read-only credentials must belong to the same tenant."
                return
            }
        }

        this.validateErrorTarget.textContent = ""
        this.validateBtnTarget.disabled = true
        this.validateBtnTarget.textContent = "Validating…"

        const roTenant = this.readOnlyCredTarget.selectedOptions[0]?.dataset?.tenant

        try {
            // Validate read-only credential has access to the subscription
            const roResult = await this.testStoredCredential(roId, roTenant, subId)
            if (!roResult.ok) {
                this.validateErrorTarget.textContent = `Read-only credential: ${roResult.error}`
                this.resetValidateBtn()
                return
            }

            // Validate admin credential if selected
            if (adminId) {
                const adminTenant = this.adminCredTarget.selectedOptions[0]?.dataset?.tenant
                const adminResult = await this.testStoredCredential(adminId, adminTenant, subId)
                if (!adminResult.ok) {
                    this.validateErrorTarget.textContent = `Admin credential: ${adminResult.error}`
                    this.resetValidateBtn()
                    return
                }
            }

            // All good — move to step 2
            this.resetValidateBtn()
            this.showStep(2)
            this.updateMonitoring()
        } catch (e) {
            this.validateErrorTarget.textContent = "Network error during validation."
            this.resetValidateBtn()
        }
    }

    async testStoredCredential(credentialId, tenantId, subscriptionId) {
        const resp = await fetch(this.testUrlValue, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-CSRF-Token": this.csrfToken()
            },
            body: JSON.stringify({
                credential_id: credentialId,
                tenant_id: tenantId,
                subscription_id: subscriptionId
            })
        })
        const data = await resp.json()

        if (!resp.ok || !data.success) {
            let err = data.error || "Authentication failed"
            if (typeof err === "object") err = err.detail || err.message || JSON.stringify(err)
            return { ok: false, error: err }
        }

        // Check if the subscription is in the accessible list
        const subs = data.data?.accessible_subscriptions || []
        const hasAccess = subs.some(s => s.subscription_id === subscriptionId)
        if (!hasAccess) {
            return { ok: false, error: `No access to subscription ${subscriptionId}` }
        }

        return { ok: true, subscriptions: subs }
    }

    resetValidateBtn() {
        this.validateBtnTarget.disabled = false
        this.validateBtnTarget.textContent = "Validate"
    }

    goBack() {
        this.showStep(1)
    }

    // ── SLA / Monitoring (same as AWS) ──

    slaChanged() {
        this.updateMonitoring()
    }

    updateMonitoring() {
        const sla = this.slaTarget.value
        const enabled = (sla === "production" || sla === "non_production")
        this.monitoringTarget.checked = enabled
        this.monitoringTarget.disabled = true

        if (enabled) {
            this.monitoringNoteTarget.innerHTML = `
                <span class="badge" style="background:var(--green-dim);color:var(--green);font-size:10px;">Monitoring</span>
                will be configured for <span style="font-weight:600;">${sla === "production" ? "Production" : "Non-Production"}</span>`
            this.monitoringNoteTarget.style.display = "block"
        } else {
            this.monitoringNoteTarget.textContent = ""
            this.monitoringNoteTarget.style.display = "none"
        }
    }

    // ── Save (submit form via fetch) ──

    async save(event) {
        event.preventDefault()

        const adminId = this.adminCredTarget.value
        // Get tenant from whichever credential is selected
        const roOpt = this.readOnlyCredTarget.selectedOptions[0]
        const tenantId = adminId
            ? this.adminCredTarget.selectedOptions[0]?.dataset?.tenant
            : roOpt?.dataset?.tenant

        const body = {
            read_only_credential_id: this.readOnlyCredTarget.value,
            subscription_id: this.subscriptionTarget.value.trim(),
            tenant_id: tenantId,
            environment_name: this.environmentNameTarget.value.trim(),
            sla: this.slaTarget.value,
            finops_enabled: this.finopsTarget.checked ? "1" : "0",
            secops_enabled: this.secopsTarget.checked ? "1" : "0",
            monitoring_enabled: this.monitoringTarget.checked ? "1" : "0"
        }
        if (adminId) body.admin_credential_id = adminId

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
                this.close()
                window.location.reload()
            } else {
                this.validateErrorTarget.textContent = data.error || "Failed to create environment."
                this.showStep(1)
            }
        } catch (e) {
            this.validateErrorTarget.textContent = "Network error."
            this.showStep(1)
        }
    }

    // ── Helpers ──

    csrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || ""
    }

    escapeHtml(str) {
        const div = document.createElement("div")
        div.textContent = str
        return div.innerHTML
    }
}
