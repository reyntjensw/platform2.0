import type { ComponentType } from "react"
import HelloWorld from "./HelloWorld"
import CanvasApp from "./canvas/CanvasApp"
import FinancialDashboard from "./dashboard/FinancialDashboard"
import SavingsPage from "./savings/SavingsPage"
import RightsizingPage from "./rightsizing/RightsizingPage"
import SecurityDashboard from "./security/SecurityDashboard"
import InventoryDashboard from "./inventory/InventoryDashboard"

const componentRegistry: Record<string, ComponentType<Record<string, unknown>>> = {
    HelloWorld,
    CanvasApp,
    FinancialDashboard,
    SavingsPage,
    RightsizingPage,
    SecurityDashboard,
    InventoryDashboard,
}

export default componentRegistry
