import { Controller } from "@hotwired/stimulus"
import { createElement } from "react"
import { createRoot, Root } from "react-dom/client"
import componentRegistry from "../components"

export default class ReactController extends Controller {
    static values = {
        component: String,
        props: { type: Object, default: {} },
    }

    declare componentValue: string
    declare propsValue: Record<string, unknown>

    private root: Root | null = null

    connect() {
        this.mountComponent()
    }

    disconnect() {
        if (this.root) {
            this.root.unmount()
            this.root = null
        }
    }

    componentValueChanged() {
        this.mountComponent()
    }

    propsValueChanged() {
        this.mountComponent()
    }

    private mountComponent() {
        const Component = componentRegistry[this.componentValue]

        if (!Component) {
            console.error(`[react_controller] Component "${this.componentValue}" not found in registry.`)
            return
        }

        if (!this.root) {
            this.root = createRoot(this.element)
        }

        this.root.render(createElement(Component, this.propsValue))
    }
}
