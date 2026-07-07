self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const title = data.title || '🚨 긴급 알림'
  const options = {
    body: data.body || '사고가 발생했습니다. 즉시 확인하세요.',
    icon: '/logo.png',
    badge: '/logo.png',
    // 3번 진동: 500ms진동 → 200ms정지 → 500ms진동 → 200ms정지 → 500ms진동
    vibrate: [500, 200, 500, 200, 500],
    tag: 'emergency-alert',
    renotify: true,
    requireInteraction: true,
    data: { deptId: data.deptId, url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const deptId = event.notification.data?.deptId
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
