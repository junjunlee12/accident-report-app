const REPORTS_KEY = 'accident_reports'
const ADMIN_KEY = 'admin_settings'

export function saveReport(report) {
  const reports = getReports()
  report.id = Date.now().toString()
  report.createdAt = new Date().toISOString()
  report.status = 'pending'
  reports.unshift(report)
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
  return report
}

export function getReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []
  } catch {
    return []
  }
}

export function deleteReport(id) {
  const reports = getReports().filter(r => r.id !== id)
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
}

export function clearAllReports() {
  localStorage.setItem(REPORTS_KEY, JSON.stringify([]))
}

export function updateReportStatus(id, status) {
  const reports = getReports()
  const idx = reports.findIndex(r => r.id === id)
  if (idx !== -1) {
    reports[idx].status = status
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
  }
}

export function getAdminSettings() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY)) || getDefaultAdminSettings()
  } catch {
    return getDefaultAdminSettings()
  }
}

export function saveAdminSettings(settings) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(settings))
}

function getDefaultAdminSettings() {
  return {
    recipients: {
      '업무용차량사고': [{ name: '', email: '' }],
      '수도권매립지관리공사': [{ name: '', email: '' }],
      '제3매립장(1단계) 매립작업 및 부대공사': [{ name: '', email: '' }],
      '수도권매립지 계측관리 용역': [{ name: '', email: '' }],
      '통합계량대 인프라 유지관리용역': [{ name: '', email: '' }],
    },
    notificationMethod: 'email',
    smtp: {
      email: '',
      appPassword: '',
    }
  }
}
