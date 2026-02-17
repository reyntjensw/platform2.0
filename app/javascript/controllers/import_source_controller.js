import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["gitFields", "registryFields", "uploadFields"]

    selectMethod({ params: { method } }) {
        this.gitFieldsTarget.style.display = method === "git_url" ? "" : "none"
        this.registryFieldsTarget.style.display = method === "registry" ? "" : "none"
        this.uploadFieldsTarget.style.display = method === "upload" ? "" : "none"
    }
}
