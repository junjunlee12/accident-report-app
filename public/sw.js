// 새 버전 배포 시 즉시 활성화 (탭 닫을 필요 없음)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(clients.claim()))

self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const title = data.title || '🚨 긴급 알림'
  const options = {
    body: data.body || '사고가 발생했습니다. 즉시 확인하세요.',
    icon: '/logo.png',
    badge: '/logo.png',
    // 3번 진동: 1초→0.5초정지→1초→0.5초정지→1초 (총 4.5초 — Android 8초 제한 이내)
    vibrate: [1000, 500, 1000, 500, 1000],
    tag: 'emergency-alert',
    renotify: true,
    requireInteraction: true,
    data: { deptId: data.deptId, mapsUrl: data.mapsUrl || null },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const { deptId, mapsUrl } = event.notification.data || {}

  // 위치 정보가 있으면 구글 지도로 바로 열기
  if (mapsUrl) {
    event.waitUntil(clients.openWindow(mapsUrl))
    return
  }

  const hash = deptId ? `#/dept/${encodeURIComponent(deptId)}` : '#/'
  const targetUrl = self.location.origin + '/' + hash
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
