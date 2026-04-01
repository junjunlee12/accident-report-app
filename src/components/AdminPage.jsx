import { useState, useEffect } from 'react'
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
  const [serverStatus, setServerStatus] = useState('checking') // 'checking', 'ok', 'not_configured', 'error'
  const [showPwChange, setShowPwChange] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [pwMessage, setPwMessage] = useState('')

  // 서버 설정 상태 확인
  const checkServerStatus = async () => {
    setServerStatus('checking')
    try {
      const API_URL = import.meta.env?.VITE_API_URL || ''
      const res = await fetch(`${API_URL}/api/settings`)
      const data = await res.json()
      if (data.success && data.settings?.smtp?.email) {
        setServerStatus('ok')
      } else {
        setServerStatus('not_configured')
      }
    } catch {
      setServerStatus('error')
    }
  }

  useEffect(() => {
    checkServerStatus()
  }, [])

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

  const handleSave = async () => {
    // 로컬에 저장
    saveAdminSettings(settings)
    // 서버에도 저장
    try {
      const API_URL = import.meta.env?.VITE_API_URL || ''
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        checkServerStatus()
      } else {
        alert('서버 저장 실패: ' + result.message)
      }
    } catch (err) {
      alert('서버에 연결할 수 없습니다: ' + err.message)
    }
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
      <h2 style={{ fontSize: '16px', marginBottom: '12px', color: '#1a365d' }}>
        관리자 설정
      </h2>

      {/* 서버 설정 상태 */}
      <div style={{
        padding: '12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: serverStatus === 'ok' ? '#c6f6d5' : serverStatus === 'checking' ? '#e2e8f0' : '#fed7d7',
        color: serverStatus === 'ok' ? '#276749' : serverStatus === 'checking' ? '#4a5568' : '#c53030',
      }}>
        <span>
          {serverStatus === 'checking' && '서버 설정 확인 중...'}
          {serverStatus === 'ok' && '서버 이메일 발송 준비 완료'}
          {serverStatus === 'not_configured' && '서버에 설정이 없습니다. 아래 설정 후 저장하세요.'}
          {serverStatus === 'error' && '서버에 연결할 수 없습니다.'}
        </span>
        <button
          onClick={checkServerStatus}
          style={{
            padding: '4px 10px', background: 'rgba(255,255,255,0.7)', border: 'none',
            borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          새로고침
        </button>
      </div>

      {/* 이메일 발송 설정 */}
      <div className="admin-card">
        <h3>이메일 발송 설정</h3>
        <div className="form-group">
          <label className="form-label">테스트 수신 이메일</label>
          <input
            type="email"
            className="form-input"
            placeholder="테스트 이메일 받을 주소"
            value={settings.smtp?.email || ''}
            onChange={e => setSettings(prev => ({
              ...prev,
              smtp: { ...prev.smtp, email: e.target.value }
            }))}
          />
        </div>
        {serverStatus === 'ok' && (
          <button
            className="btn-add"
            onClick={async () => {
              try {
                const API_URL = import.meta.env?.VITE_API_URL || ''
                const res = await fetch(`${API_URL}/api/test-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ testTo: settings.smtp?.email })
                })
                const result = await res.json()
                alert(result.message)
              } catch {
                alert('서버에 연결할 수 없습니다.')
              }
            }}
          >
            테스트 이메일 발송
          </button>
        )}
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

      <button
        className="btn-save"
        onClick={handleSave}
      >
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
