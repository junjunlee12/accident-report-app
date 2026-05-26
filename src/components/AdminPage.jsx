import { useState, useEffect } from 'react'
import { getAdminSettings, saveAdminSettings } from '../utils/storage'
import { logoutAdmin, changeAdminCredentials, transferAdmin, getAdminToken } from '../utils/auth'
import { DEFAULT_PROJECTS, getAllRecipientKeys, SPECIAL_RECIPIENT_KEYS } from '../config/projects'
import { DEPARTMENTS } from '../config/departments'

export default function AdminPage({ onAuthChange }) {
  const [selectedDept, setSelectedDept] = useState('매립운영처')
  const [settings, setSettings] = useState(() => {
    const stored = getAdminSettings()
    if (!stored.projects) stored.projects = DEFAULT_PROJECTS
    return stored
  })
  const [saved, setSaved] = useState(false)
  const [serverStatus, setServerStatus] = useState('checking')
  const [showPwChange, setShowPwChange] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [pwMessage, setPwMessage] = useState('')
  const [showProjectEditor, setShowProjectEditor] = useState(false)

  // 사업명 목록 (업무용차량사고 + 사업명들)
  const PROJECT_NAMES = getAllRecipientKeys(settings.projects)

  // 서버 설정 상태 확인
  const checkServerStatus = async (dept) => {
    const deptToLoad = dept || selectedDept
    setServerStatus('checking')
    try {
      const API_URL = import.meta.env?.VITE_API_URL || ''
      const res = await fetch(`${API_URL}/api/settings?dept=${encodeURIComponent(deptToLoad)}`, {
        headers: { 'X-Admin-Token': getAdminToken() }
      })
      const data = await res.json()

      // 서버 데이터가 항상 우선 (어떤 기기에서 접속해도 동일)
      if (data.settings) {
        setSettings(prev => ({
          ...prev,
          ...data.settings,
          // 기본값이 있는 필드는 서버값이 없으면 기존값 유지
          projects: data.settings.projects || prev.projects || DEFAULT_PROJECTS,
          recipients: data.settings.recipients || prev.recipients || {},
          smtp: data.settings.smtp || prev.smtp || { email: '', appPassword: '' },
          senderEmail: data.settings.senderEmail || prev.senderEmail || '',
          kakaoLink: data.settings.kakaoLink || '',
        }))
      }

      if (data.success) {
        setServerStatus('ok')
      } else {
        setServerStatus('not_configured')
      }
    } catch {
      setServerStatus('error')
    }
  }

  useEffect(() => {
    checkServerStatus(selectedDept)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept])

  // 사업 편집 함수들
  const addProject = () => {
    setSettings(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '새 사업명', companies: [{ label: '소속명' }] }]
    }))
  }

  const updateProjectName = (idx, newName) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.projects = [...prev.projects]
      updated.projects[idx] = { ...updated.projects[idx], name: newName }
      return updated
    })
  }

  const removeProject = (idx) => {
    if (!confirm('이 사업을 삭제하시겠습니까?')) return
    setSettings(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== idx)
    }))
  }

  const addCompany = (projectIdx) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.projects = [...prev.projects]
      updated.projects[projectIdx] = {
        ...updated.projects[projectIdx],
        companies: [...updated.projects[projectIdx].companies, { label: '' }]
      }
      return updated
    })
  }

  const updateCompany = (projectIdx, companyIdx, field, value) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.projects = [...prev.projects]
      const project = { ...updated.projects[projectIdx] }
      project.companies = [...project.companies]
      project.companies[companyIdx] = { ...project.companies[companyIdx], [field]: value }
      // label 자동 변경 시 base도 같이 업데이트 (하도급 포함 제거 안 한 경우)
      if (field === 'label' && !project.companies[companyIdx].base) {
        project.companies[companyIdx].base = value.replace(/\(하도급 포함\)/g, '').trim()
      }
      updated.projects[projectIdx] = project
      return updated
    })
  }

  const removeCompany = (projectIdx, companyIdx) => {
    setSettings(prev => {
      const updated = { ...prev }
      updated.projects = [...prev.projects]
      const project = { ...updated.projects[projectIdx] }
      project.companies = project.companies.filter((_, i) => i !== companyIdx)
      updated.projects[projectIdx] = project
      return updated
    })
  }

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
      const res = await fetch(`${API_URL}/api/settings?dept=${encodeURIComponent(selectedDept)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken()
        },
        body: JSON.stringify(settings)
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        checkServerStatus(selectedDept)
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

      {/* 부서 선택 */}
      <div className="admin-card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0 }}>편집 부서 선택</h3>
          <span style={{ fontSize: '13px', color: '#4a5568', fontWeight: '600' }}>
            현재 편집 중인 부서: <span style={{ color: '#1a365d' }}>{selectedDept}</span>
          </span>
        </div>
        <select
          className="form-select"
          value={selectedDept}
          onChange={e => {
            setSelectedDept(e.target.value)
            setSaved(false)
          }}
        >
          {DEPARTMENTS.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.id}</option>
          ))}
        </select>
      </div>

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
        <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', lineHeight: 1.5 }}>
          보고서 발송 시 발신자로 표시될 이메일 주소입니다.<br />
          Brevo에서 인증한 이메일 주소를 입력하세요.
        </p>
        <div className="form-group">
          <label className="form-label">발송자 이메일 <span className="required">*</span></label>
          <input
            type="email"
            className="form-input"
            placeholder="발신자 이메일 주소"
            value={settings.senderEmail || ''}
            onChange={e => setSettings(prev => ({
              ...prev,
              senderEmail: e.target.value
            }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">카카오 오픈채팅 링크</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://open.kakao.com/o/..."
            value={settings.kakaoLink || ''}
            onChange={e => setSettings(prev => ({
              ...prev,
              kakaoLink: e.target.value
            }))}
          />
          <p style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
            보고서 작성 화면 상단의 "상황알림" 버튼에 사용됩니다.
          </p>
        </div>
        {serverStatus === 'ok' && settings.senderEmail && (
          <button
            className="btn-add"
            onClick={async () => {
              try {
                const API_URL = import.meta.env?.VITE_API_URL || ''
                const res = await fetch(`${API_URL}/api/test-email?dept=${encodeURIComponent(selectedDept)}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken()
                  },
                  body: JSON.stringify({ testTo: settings.senderEmail })
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

      {/* 사업/소속 편집 */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>사업명 / 소속 관리</h3>
          <button
            className="btn-add"
            onClick={() => setShowProjectEditor(!showProjectEditor)}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {showProjectEditor ? '접기' : '편집'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', lineHeight: 1.5 }}>
          부서명이나 사업명이 변경되면 여기서 수정하세요.<br />
          설정 저장 후 모든 사용자에게 자동 반영됩니다.
        </p>

        {showProjectEditor && (
          <div>
            {settings.projects.map((project, pIdx) => (
              <div key={pIdx} style={{
                padding: '12px', marginBottom: '10px', background: '#f8fafc',
                borderRadius: '8px', border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a365d', minWidth: '50px' }}>사업명</span>
                  <input
                    type="text"
                    className="form-input"
                    value={project.name}
                    onChange={e => updateProjectName(pIdx, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn-remove"
                    onClick={() => removeProject(pIdx)}
                    title="사업 삭제"
                  >
                    &#x2715;
                  </button>
                </div>
                <div style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '2px solid #bee3f8' }}>
                  <div style={{ fontSize: '12px', color: '#4a5568', marginBottom: '6px', fontWeight: 600 }}>
                    소속 목록
                  </div>
                  {project.companies.map((company, cIdx) => (
                    <div key={cIdx} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="소속명 (예: (주)대우건설(하도급 포함))"
                        value={company.label}
                        onChange={e => updateCompany(pIdx, cIdx, 'label', e.target.value)}
                        style={{ flex: 1, fontSize: '13px' }}
                      />
                      {project.companies.length > 1 && (
                        <button
                          className="btn-remove"
                          onClick={() => removeCompany(pIdx, cIdx)}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          &#x2715;
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="btn-add"
                    onClick={() => addCompany(pIdx)}
                    style={{ fontSize: '11px', padding: '4px 10px', marginTop: '4px' }}
                  >
                    + 소속 추가
                  </button>
                </div>
              </div>
            ))}
            <button
              className="btn-add"
              onClick={addProject}
              style={{ width: '100%', padding: '10px' }}
            >
              + 사업 추가
            </button>
            <p style={{ fontSize: '11px', color: '#718096', marginTop: '8px', lineHeight: 1.5 }}>
              💡 하도급업체가 있는 소속은 이름 뒤에 "(하도급 포함)"을 붙이세요.<br />
              &nbsp;&nbsp;&nbsp;&nbsp;예: (주)대우건설(하도급 포함)<br />
              💡 하도급업체명 미입력 시 발생경위에서 "(하도급 포함)"은 자동으로 제거됩니다.
            </p>
          </div>
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
