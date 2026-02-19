import type { ComponentType } from "react"
import HelloWorld from "./HelloWorld"
import CanvasApp from "./canvas/CanvasApp"
import FinancialDashboard from "./dashboard/FinancialDashboard"

const componentRegistry: Record<string, ComponentType<Record<string, unknown>>> = {
    HelloWorld,
    CanvasApp,
    FinancialDashboard,
}

export default componentRegistry
