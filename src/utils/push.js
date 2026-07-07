const API_URL = import.meta.env?.VITE_API_URL || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushStatus() {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function subscribePush(deptId) {
  const reg = await navigator.serviceWorker.ready

  const res = await fetch(`${API_URL}/api/push/vapid-public-key`)
  const { publicKey } = await res.json()

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await fetch(`${API_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, deptId }),
  })

  return subscription
}

export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.getSubscription()
  if (!subscription) return

  await fetch(`${API_URL}/api/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  await subscription.unsubscribe()
}
