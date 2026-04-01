const ADMIN_KEY = 'admin_auth'
const DEFAULT_ID = 'merib'
const DEFAULT_PASSWORD = 'slc1000'

export function isAdmin() {
  try {
    const auth = JSON.parse(localStorage.getItem(ADMIN_KEY))
    return auth?.isAdmin === true
  } catch {
    return false
  }
}

export function loginAdmin(id, password) {
  const savedId = getAdminId()
  const savedPassword = getAdminPassword()
  if (id === savedId && password === savedPassword) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ isAdmin: true, loginAt: new Date().toISOString() }))
    return true
  }
  return false
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_KEY)
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
