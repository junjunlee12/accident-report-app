const ADMIN_KEY = 'admin_auth'
const ADMIN_TOKEN_KEY = 'admin_token'
const DEFAULT_ID = 'merib'
const DEFAULT_PASSWORD = 'slc1000'

export function isAdmin() {
  try {
    const auth = JSON.parse(localStorage.getItem(ADMIN_KEY))
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)
    return auth?.isAdmin === true && !!token
  } catch {
    return false
  }
}

// 서버 인증 기반 로그인 (토큰 받아옴)
export async function loginAdmin(id, password) {
  try {
    const API_URL = import.meta.env?.VITE_API_URL || ''
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    })
    const data = await res.json()
    if (data.success && data.token) {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ isAdmin: true, loginAt: new Date().toISOString() }))
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      return { success: true }
    }
    return { success: false, message: data.message || '로그인 실패' }
  } catch (err) {
    // 서버 연결 실패 시 로컬 폴백 (오프라인 호환성)
    if (id === DEFAULT_ID && password === DEFAULT_PASSWORD) {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ isAdmin: true, loginAt: new Date().toISOString() }))
      // 토큰은 못 받았지만 화면은 보여줌 (서버 깨어나면 다시 로그인 필요)
      return { success: true, offline: true }
    }
    return { success: false, message: '서버에 연결할 수 없습니다: ' + err.message }
  }
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_KEY)
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

export function getAdminId() {
  return localStorage.getItem('admin_id') || DEFAULT_ID
}

export function getAdminPassword() {
  return localStorage.getItem('admin_password') || DEFAULT_PASSWORD
}

export function changeAdminCredentials(currentPw, newId, newPw) {
  if (currentPw !== getAdminPassword()) {
    return { success: false, message: '현재 비밀번호가 일치하지 않습니다.' }
  }
  if (newPw && newPw.length < 4) {
    return { success: false, message: '새 비밀번호는 4자 이상이어야 합니다.' }
  }
  if (newId) localStorage.setItem('admin_id', newId)
  if (newPw) localStorage.setItem('admin_password', newPw)
  return { success: true, message: '계정 정보가 변경되었습니다.' }
}

export function transferAdmin(currentPw, newId, newPw) {
  const result = changeAdminCredentials(currentPw, newId, newPw)
  if (result.success) {
    logoutAdmin()
    return { success: true, message: '관리자 권한이 이양되었습니다. 새 담당자에게 ID/비밀번호를 전달하세요.' }
  }
  return result
}
