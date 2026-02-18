import { useState, useEffect, useCallback, useRef } from "react"
import { csrf } from "./constants"

const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const STATUS_POLL_INTERVAL = 15000 // 15 seconds when not holding lock

function generateDeviceId() {
    let id = sessionStorage.getItem("canvas_device_id")
    if (!id) {
        id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        sessionStorage.setItem("canvas_device_id", id)
    }
    return id
}

export default function useCanvasLock(lockApiUrl) {
    const [lockState, setLockState] = useState({ locked: false, holder: null, isMe: false })
    const [acquiring, setAcquiring] = useState(false)
    const deviceId = useRef(generateDeviceId()).current
    const heartbeatRef = useRef(null)
    const pollRef = useRef(null)

    const fetchStatus = useCallback(async () => {
        try {
            const resp = await fetch(`${lockApiUrl}/status`)
            if (!resp.ok) return
            const data = await resp.json()
            if (data.locked) {
                setLockState({
                    locked: true,
                    holder: data.lock,
                    isMe: data.lock.device_id === deviceId
                })
            } else {
                setLockState({ locked: false, holder: null, isMe: false })
            }
        } catch { /* ignore */ }
    }, [lockApiUrl, deviceId])

    // Poll lock status when we don't hold the lock
    useEffect(() => {
        fetchStatus()
        pollRef.current = setInterval(() => {
            if (!lockState.isMe) fetchStatus()
        }, STATUS_POLL_INTERVAL)
        return () => clearInterval(pollRef.current)
    }, [fetchStatus, lockState.isMe])

    const acquire = useCallback(async () => {
        setAcquiring(true)
        try {
            const resp = await fetch(`${lockApiUrl}/acquire`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
                body: JSON.stringify({ device_id: deviceId })
            })
            if (resp.ok) {
                const lock = await resp.json()
                setLockState({ locked: true, holder: lock, isMe: true })
                // Start heartbeat
                clearInterval(heartbeatRef.current)
                heartbeatRef.current = setInterval(async () => {
                    try {
                        const r = await fetch(`${lockApiUrl}/renew`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
                            body: JSON.stringify({ device_id: deviceId })
                        })
                        if (!r.ok) {
                            clearInterval(heartbeatRef.current)
                            setLockState(prev => ({ ...prev, isMe: false }))
                            fetchStatus()
                        }
                    } catch {
                        clearInterval(heartbeatRef.current)
                        setLockState(prev => ({ ...prev, isMe: false }))
                    }
                }, HEARTBEAT_INTERVAL)
                return { ok: true }
            } else if (resp.status === 409) {
                const data = await resp.json()
                setLockState({ locked: true, holder: data.lock, isMe: false })
                return { ok: false, holder: data.lock }
            }
            return { ok: false }
        } catch {
            return { ok: false }
        } finally {
            setAcquiring(false)
        }
    }, [lockApiUrl, deviceId, fetchStatus])

    const release = useCallback(async () => {
        clearInterval(heartbeatRef.current)
        try {
            await fetch(`${lockApiUrl}/release`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
                body: JSON.stringify({ device_id: deviceId })
            })
        } catch { /* best effort */ }
        setLockState({ locked: false, holder: null, isMe: false })
        fetchStatus()
    }, [lockApiUrl, deviceId, fetchStatus])

    // Release lock on unmount / page unload
    useEffect(() => {
        const onUnload = () => {
            if (lockState.isMe) {
                navigator.sendBeacon(
                    `${lockApiUrl}/release?device_id=${deviceId}&_method=DELETE`,
                )
            }
        }
        window.addEventListener("beforeunload", onUnload)
        return () => {
            window.removeEventListener("beforeunload", onUnload)
            clearInterval(heartbeatRef.current)
            if (lockState.isMe) {
                // Fire-and-forget release on component unmount
                fetch(`${lockApiUrl}/release`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
                    body: JSON.stringify({ device_id: deviceId }),
                    keepalive: true
                }).catch(() => { })
            }
        }
    }, [lockApiUrl, deviceId, lockState.isMe])

    return { lockState, acquire, release, acquiring }
}
