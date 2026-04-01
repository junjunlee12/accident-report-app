import { useState } from 'react'
import { getAdminSettings, saveAdminSettings } from '../utils/storage'
import { logoutAdmin, changeAdminCredentials, transferAdmin } from '../utils/auth'

const PROJECT_NAMES = [
  '제3매립장(1단계) 매립작업 및 부대공사',
  '수도권매립지 계측관리 용역',
  '통합계량대 인프라 유지관리용역',
]

export default function AdminPage({ onAuthChange }) {
  const [settings, setSettings] = useState(getAdminSettings())
  const [saved, setSaved] = useState(false)
  const [showPwChange, setShowPwChange] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [pwMessage, setPwMessage] = useState('')

  const updateRecipient = (project, idx, field, value) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.recipients = { ...updated.recipients }
      updated.recipients[project] = [...updated.recipients[project]]
      updated.recipients[project][idx] = {
        ...updated.recipients[project][idx],
        [field]: value
      }
      return updated
    })
  }

  const addRecipient = (project) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.recipients = { ...updated.recipients }
      updated.recipients[project] = [
        ...(updated.recipients[project] || []),
        { name: '', email: '' }
      ]
      return updated
    })
  }

  const removeRecipient = (project, idx) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.recipients = { ...updated.recipients }
      updated.recipients[project] = updated.recipients[project].filter((_, i) => i !== idx)
      return updated
    })
  }

  const handleSave = () => {
    saveAdminSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = () => {
    if (confirm('관리자에서 로그아웃하시겠습니까?')) {
      logoutAdmin()
      onAuthChange()
    }
  }

  const handlePasswordChange = () => {
    if (newPw !== newPwConfirm) {
      setPwMessage('새 비밀번호가 일치하지 않습니다.')
      return
    }
    const result = changeAdminCredentials(currentPw, null, newPw)
    setPwMessage(result.message)
    if (result.success) {
      setCurrentPw('')
      setNewPw('')
      setNewPwConfirm('')
      setTimeout(() => { setShowPwChange(false); setPwMessage('') }, 1500)
    }
  }

  const handleTransfer = () => {
    if (newPw !== newPwConfirm) {
      setPwMessage('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (!confirm('관리자 권한을 이양하면 본인은 로그아웃됩니다.\n새 담당자에게 새 비밀번호를 전달해야 합니다.\n계속하시겠습니까?')) {
      return
    }
    const result = transferAdmin(currentPw, null, newPw)
    setPwMessage(result.message)
    if (result.success) {
      setTimeout(() => onAuthChange(), 2000)
    }
  }

  const resetPwForm = () => {
    setCurrentPw('')
    setNewPw('')
    setNewPwConfirm('')
    setPwMessage('')
    setShowPwChange(false)
    setShowTransfer(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#1a365d' }}>
        관리자 설정
      </h2>

      {/* 발송 Gmail 설정 */}
      <div className="admin-card">
        <h3>발송 이메일 설정 (Gmail)</h3>
        <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', lineHeight: 1.5 }}>
          보고서를 발송할 Gmail 계정을 설정하세요.<br />
          Google 계정 &gt; 보안 &gt; 2단계 인증 활성화 후<br />
          앱 비밀번호를 생성하여 입력하세요.
        </p>
        <div className="form-group">
          <label className="form-label">Gmail 주소</label>
          <input
            type="email"
            className="form-input"
            placeholder="example@gmail.com"
            value={settings.smtp?.email || ''}
            onChange={e => setSettings(prev => ({
              ...prev,
              smtp: { ...prev.smtp, email: e.target.value }
            }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">앱 비밀번호 (16자리)</label>
          <input
            type="password"
            className="form-input"
            placeholder="Google 앱 비밀번호 입력"
            value={settings.smtp?.appPassword || ''}
            onChange={e => setSettings(prev => ({
              ...prev,
              smtp: { ...prev.smtp, appPassword: e.target.value }
            }))}
          />
        </div>
        {settings.smtp?.email && settings.smtp?.appPassword && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{
              flex: 1, padding: '8px 12px', background: '#c6f6d5', borderRadius: '6px',
              fontSize: '12px', color: '#276749'
            }}>
              발송 준비 완료
            </div>
            <button
              className="btn-add"
              style={{ whiteSpace: 'nowrap' }}
              onClick={async () => {
                try {
                  const API_URL = import.meta.env?.VITE_API_URL || ''
                  const res = await fetch(`${API_URL}/api/test-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ smtp: settings.smtp })
                  })
                  const result = await res.json()
                  alert(result.message)
                } catch {
                  alert('서버에 연결할 수 없습니다.\n서버(node server/server.js)가 실행 중인지 확인하세요.')
                }
              }}
            >
              테스트 발송
            </button>
          </div>
        )}
        {(!settings.smtp?.email || !settings.smtp?.appPassword) && (
          <div style={{
            padding: '8px 12px', background: '#fefcbf', borderRadius: '6px',
            fontSize: '12px', color: '#975a16'
          }}>
            Gmail 주소와 앱 비밀번호를 입력해야 이메일이 발송됩니다.
          </div>
        )}
      </div>

      {/* 알림 방법 */}
      <div className="admin-card">
        <h3>알림 방법</h3>
        <select
          className="form-select"
          value={settings.notificationMethod}
          onChange={e => setSettings(prev => ({ ...prev, notificationMethod: e.target.value }))}
        >
          <option value="email">이메일 (Gmail)</option>
          <option value="sms">문자 (SMS)</option>
          <option value="both">이메일 + 문자</option>
        </select>
      </div>

      {/* 사업명별 수신자 */}
      {PROJECT_NAMES.map(project => (
        <div key={project} className="admin-card">
          <h3>{project}</h3>
          <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px' }}>
            이 사업에서 사고 발생 시 보고서를 수신할 담당자
          </p>

          {(settings.recipients[project] || []).map((recipient, idx) => (
            <div key={idx} className="recipient-row">
              <input
                type="text"
                className="form-input"
                placeholder="담당자명"
                value={recipient.name}
                onChange={e => updateRecipient(project, idx, 'name', e.target.value)}
                style={{ flex: '0 0 30%' }}
              />
              <input
                type="email"
                className="form-input"
                placeholder="이메일 주소"
                value={recipient.email}
                onChange={e => updateRecipient(project, idx, 'email', e.target.value)}
              />
              {(settings.recipients[project] || []).length > 1 && (
                <button
                  className="btn-remove"
                  onClick={() => removeRecipient(project, idx)}
                >
                  &#x2715;
                </button>
              )}
            </div>
          ))}

          <button className="btn-add" onClick={() => addRecipient(project)}>
            + 수신자 추가
          </button>
        </div>
      ))}

      <button className="btn-save" onClick={handleSave}>
        {saved ? '저장 완료!' : '설정 저장'}
      </button>

      {/* 계정 관리 */}
      <div className="admin-card" style={{ marginTop: '24px' }}>
        <h3>계정 관리</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-add"
            onClick={() => { resetPwForm(); setShowPwChange(true) }}
            style={{ flex: 1 }}
          >
            비밀번호 변경
          </button>
          <button
            className="btn-add"
            onClick={() => { resetPwForm(); setShowTransfer(true) }}
            style={{ flex: 1, background: '#fff5f5', color: '#e53e3e', borderColor: '#fed7d7' }}
          >
            관리자 권한 이양
          </button>
        </div>
      </div>

      {/* 비밀번호 변경 / 권한 이양 모달 */}
      {(showPwChange || showTransfer) && (
        <div className="modal-overlay" onClick={resetPwForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'left' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '4px' }}>
              {showTransfer ? '관리자 권한 이양' : '비밀번호 변경'}
            </h3>
            {showTransfer && (
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#e53e3e', marginBottom: '16px' }}>
                권한 이양 후 본인은 로그아웃됩니다.<br />
                새 비밀번호를 후임자에게 전달하세요.
              </p>
            )}

            <div className="form-group">
              <label className="form-label">현재 비밀번호</label>
              <input
                type="password"
                className="form-input"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">새 비밀번호</label>
              <input
                type="password"
                className="form-input"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">새 비밀번호 확인</label>
              <input
                type="password"
                className="form-input"
                value={newPwConfirm}
                onChange={e => setNewPwConfirm(e.target.value)}
              />
            </div>

            {pwMessage && (
              <p style={{
                fontSize: '13px', textAlign: 'center', marginBottom: '12px',
                color: pwMessage.includes('성공') || pwMessage.includes('변경되었') || pwMessage.includes('이양되었') ? '#276749' : '#e53e3e'
              }}>
                {pwMessage}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="modal-btn"
                onClick={resetPwForm}
                style={{ background: '#edf2f7', color: '#4a5568' }}
              >
                취소
              </button>
              <button
                className="modal-btn"
                onClick={showTransfer ? handleTransfer : handlePasswordChange}
                style={showTransfer ? { background: '#e53e3e' } : {}}
              >
                {showTransfer ? '권한 이양' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
