const ADMIN_KEY = 'admin_auth'
const ADMIN_TOKEN_KEY = 'admin_token'

export function isAdmin() {
  try {
    const auth = JSON.parse(localStorage.getItem(ADMIN_KEY))
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)
    return auth?.isAdmin === true && !!token
  } catch {
    return false
  }
}

export function getAdminRole() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY))?.role || 'super'
  } catch { return 'super' }
}

export function getAdminDept() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY))?.deptId || null
  } catch { return null }
}

export function isSuperAdmin() {
  return getAdminRole() === 'super'
}

// 슈퍼관리자 로그인
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
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ isAdmin: true, role: 'super', loginAt: new Date().toISOString() }))
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      return { success: true }
    }
    return { success: false, message: data.message || '로그인 실패' }
  } catch (err) {
    return { success: false, message: '서버에 연결할 수 없습니다: ' + err.message }
  }
}

// 부서 관리자 로그인
export async function loginDeptAdmin(deptId, adminId, adminPw) {
  const API_URL = import.meta.env?.VITE_API_URL || ''
  const res = await fetch(`${API_URL}/api/dept-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deptId, adminId, adminPw })
  })
  const data = await res.json()
  if (data.success && data.token) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify({
      isAdmin: true, role: 'dept', deptId: data.deptId, loginAt: new Date().toISOString()
    }))
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
    return { success: true }
  }
  return { success: false, message: data.message || '로그인 실패' }
}

// 부서 관리자 신청
export async function applyDeptAdmin(deptId, adminId, adminPw) {
  const API_URL = import.meta.env?.VITE_API_URL || ''
  const res = await fetch(`${API_URL}/api/dept-admin/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deptId, adminId, adminPw })
  })
  return await res.json()
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_KEY)
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

// 슈퍼관리자 비밀번호 변경 (로컬 설정 - 서버는 별도 관리)
export function changeAdminCredentials(currentPw, newId, newPw) {
  const stored = localStorage.getItem('admin_password') || 'slc1000'
  if (currentPw !== stored) return { success: false, message: '현재 비밀번호가 일치하지 않습니다.' }
  if (newPw && newPw.length < 4) return { success: false, message: '새 비밀번호는 4자 이상이어야 합니다.' }
  if (newId) localStorage.setItem('admin_id', newId)
  if (newPw) localStorage.setItem('admin_password', newPw)
  return { success: true, message: '계정 정보가 변경되었습니다.' }
}

export function transferAdmin(currentPw, newId, newPw) {
  const result = changeAdminCredentials(currentPw, newId, newPw)
  if (result.success) {
    logoutAdmin()
    return { success: true, message: '관리자 권한이 이양되었습니다.' }
  }
  return result
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}
