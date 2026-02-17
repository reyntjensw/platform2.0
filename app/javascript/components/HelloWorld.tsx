import React from "react"

interface HelloWorldProps {
  name?: string
}

export default function HelloWorld({ name = "World" }: HelloWorldProps) {
  return (
    <div style={{ padding: "16px", color: "#2ecc71" }}>
      <h2>Hello, {name}!</h2>
      <p>React is working inside Rails.</p>
    </div>
  )
}
