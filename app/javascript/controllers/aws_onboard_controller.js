import { Controller } from "@hotwired/stimulus"

// 2-step AWS environment onboarding modal.
// Step 1: Account ID, Environment name, Role Name, External ID (readonly, auto-generated) → Validate
// Step 2: SLA, Integrations (FinOps, SecOps, Monitoring auto-set by SLA) → Save
export default class extends Controller {
    static targets = [
        "overlay", "step1", "step2",
        "accountId", "environmentName", "roleName", "externalId",
        "sla", "finops", "secops", "monitoring", "monitoringNote",
        "validateBtn", "validateError", "stepIndicator"
    ]
    static values = { validateUrl: String, customerUuid: String, projectUuid: String }

    connect() {
        this.generateExternalId()
    }

    open() {
        this.generateExternalId()
        this.resetForm()
        this.overlayTarget.classList.add("open")
        document.body.style.overflow = "hidden"
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

    generateExternalId() {
        this.externalIdTarget.value = crypto.randomUUID()
    }

    copyExternalId() {
        const text = this.externalIdTarget.value
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
        } else {
            // Fallback for non-secure contexts
            this.externalIdTarget.select()
            document.execCommand("copy")
        }
    }

    resetForm() {
        this.showStep(1)
        this.accountIdTarget.value = ""
        this.environmentNameTarget.value = ""
        this.roleNameTarget.value = ""
        if (this.hasValidateErrorTarget) this.validateErrorTarget.textContent = ""
        this.validateBtnTarget.disabled = false
        this.validateBtnTarget.textContent = "Validate"
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

    async validate() {
        const btn = this.validateBtnTarget
        const accountId = this.accountIdTarget.value.trim()
        const roleName = this.roleNameTarget.value.trim()
        const externalId = this.externalIdTarget.value

        if (!accountId || !roleName) {
            this.validateErrorTarget.textContent = "Account ID and Role Name are required."
            return
        }

        btn.disabled = true
        btn.textContent = "Validating..."
        this.validateErrorTarget.textContent = ""

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
            const resp = await fetch(this.validateUrlValue, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                body: JSON.stringify({
                    account_id: accountId,
                    external_id: externalId,
                    role_name: roleName
                })
            })

            const data = await resp.json()

            if (resp.ok && data.valid) {
                this.showStep(2)
                this.updateMonitoring()
            } else {
                this.validateErrorTarget.textContent = data.error || "Validation failed. Check your role configuration."
                btn.disabled = false
                btn.textContent = "Validate"
            }
        } catch (e) {
            this.validateErrorTarget.textContent = "Network error. Please try again."
            btn.disabled = false
            btn.textContent = "Validate"
        }
    }

    goBack() {
        this.showStep(1)
        this.validateBtnTarget.disabled = false
        this.validateBtnTarget.textContent = "Validate"
    }

    slaChanged() {
        this.updateMonitoring()
    }

    updateMonitoring() {
        const sla = this.slaTarget.value
        const enabled = (sla === "production" || sla === "non_production")
        this.monitoringTarget.checked = enabled
        this.monitoringTarget.disabled = true

        if (enabled) {
            this.monitoringNoteTarget.textContent = `Monitoring will be configured for ${sla === "production" ? "Production" : "Non-Production"}`
            this.monitoringNoteTarget.style.display = "block"
        } else {
            this.monitoringNoteTarget.textContent = ""
            this.monitoringNoteTarget.style.display = "none"
        }
    }
}
