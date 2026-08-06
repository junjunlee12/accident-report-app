const API_URL = import.meta.env?.VITE_API_URL || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// 기기 고유 ID — 같은 기기에서 중복 구독 방지용, 테스트 알림 발송에도 사용
export function getDeviceId() {
  let id = localStorage.getItem('push_device_id')
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
    localStorage.setItem('push_device_id', id)
  }
  return id
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// 현재 구독 중인 부서를 localStorage에 저장/조회 (브라우저 구독은 전역이지만 부서별 구분 필요)
const SUBSCRIBED_DEPT_KEY = 'push_subscribed_dept'

export async function getPushStatus(deptId) {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return 'unsubscribed'

  if (deptId) {
    const storedDept = localStorage.getItem(SUBSCRIBED_DEPT_KEY)
    if (storedDept !== null) {
      // localStorage에 기록 있으면 빠른 경로
      return storedDept === deptId ? 'subscribed' : 'unsubscribed'
    }
    // 기존 구독자 migration: endpoint(가장 신뢰도 높음) + deviceId로 서버 조회 후 localStorage에 기록
    // 서버 슬립 중 무한 대기 방지 — 5초 타임아웃
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${API_URL}/api/push/my-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, deviceId: getDeviceId() }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.deptId) {
        localStorage.setItem(SUBSCRIBED_DEPT_KEY, data.deptId)
        return data.deptId === deptId ? 'subscribed' : 'unsubscribed'
      }
    } catch {}
    return 'unsubscribed'
  }

  return 'subscribed'
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
    body: JSON.stringify({ subscription, deptId, deviceId: getDeviceId() }),
  })

  // 구독 부서 로컬에 기록 (다른 부서 페이지에서 '알림켜짐' 오표시 방지)
  localStorage.setItem(SUBSCRIBED_DEPT_KEY, deptId)

  return subscription
}

export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.getSubscription()
  if (!subscription) return

  await fetch(`${API_URL}/api/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, deviceId: getDeviceId() }),
  })

  await subscription.unsubscribe()
  localStorage.removeItem(SUBSCRIBED_DEPT_KEY)
}
