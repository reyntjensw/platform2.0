import type { ComponentType } from "react"
import HelloWorld from "./HelloWorld"
import CanvasApp from "./canvas/CanvasApp"

const componentRegistry: Record<string, ComponentType<Record<string, unknown>>> = {
    HelloWorld,
    CanvasApp,
}

export default componentRegistry
