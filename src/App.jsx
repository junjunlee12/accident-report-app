import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import ReportForm from './components/ReportForm'
import AdminPage from './components/AdminPage'
import ReportList from './components/ReportList'
import AdminLogin from './components/AdminLogin'
import DepartmentSelect from './components/DepartmentSelect'
import { getDeptById } from './config/departments'
import { isAdmin, logoutAdmin } from './utils/auth'
import { isPushSupported, getPushStatus, subscribePush, unsubscribePush } from './utils/push'
import './App.css'

const INITIAL_FORM = {
  isVehicleAccident: false, vehicleNumber: '',
  isMockDrill: false,
  projectName: '', company: '', subContractor: '', location: '',
  date: '', time: '',
  personNone: false,
  rank: '', name: '', phone: '', birthDate: '',
  workExperienceYears: '', workExperienceMonths: '',
  description: '',
  damageNone: false,
  damageHuman: false, damageHumanDetail: '',
  damageProperty: false, damagePropertyDetail: '',
  action: '', photos: [],
  showPrivacy: false, privacyAgreed: false,
}

// 🚨 긴급 버튼
function EmergencyButton({ deptId }) {
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [gpsStatus, setGpsStatus] = useState('unknown') // unknown | granted | denied | unavailable

  // 마운트 시 GPS 권한 상태 확인
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return }
    if (!navigator.permissions) return
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      setGpsStatus(result.state) // 'granted' | 'denied' | 'prompt'
      result.onchange = () => setGpsStatus(result.state)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const getLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 30000 }  // 5초 → 10초
    )
  })

  const handlePress = async () => {
    if (sending || cooldown > 0) return
    if (gpsStatus === 'denied') {
      if (!confirm('⚠️ 위치 권한이 차단되어 있습니다.\n지도 링크 없이 알림만 발송됩니다.\n\n위치 포함을 원하면 브라우저 설정에서 위치 권한을 허용해 주세요.\n\n그냥 발송하시겠습니까?')) return
    } else {
      if (!confirm('🚨 긴급 상황 알림을 발송하시겠습니까?\n\n구독자 전체에게 즉시 푸시가 전송됩니다.')) return
    }
    setSending(true)
    try {
      const location = await getLocation()
      const API_URL = import.meta.env?.VITE_API_URL || ''
      const res = await fetch(`${API_URL}/api/push/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deptId, location }),
      })
      const data = await res.json()
      if (data.success) {
        const locMsg = location
          ? '\n📍 위치 정보 포함 — 알림 클릭 시 지도 열림'
          : '\n📍 위치 없음 — 브라우저 위치 권한을 확인하세요'
        alert(`✅ 알림 발송 완료 (${data.sent}명 수신)${locMsg}`)
        setCooldown(60)
      } else {
        alert('⚠️ ' + data.message)
      }
    } catch {
      alert('서버 연결 실패. 잠시 후 다시 시도하세요.')
    } finally {
      setSending(false)
    }
  }

  const disabled = sending || cooldown > 0

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        onClick={handlePress}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '18px',
          background: disabled ? '#e2e8f0' : 'linear-gradient(135deg, #c53030, #e53e3e)',
          color: disabled ? '#a0aec0' : 'white',
          border: 'none',
          borderRadius: '14px',
          fontSize: '18px',
          fontWeight: '800',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: disabled ? 'none' : '0 4px 15px rgba(197,48,48,0.4)',
          letterSpacing: '-0.3px',
          transition: 'all 0.2s',
        }}
      >
        {sending ? '발송 중...' : cooldown > 0 ? `🚨 재발송 대기 (${cooldown}초)` : '🚨 긴급 상황 알림 발송'}
      </button>
      {gpsStatus === 'denied' && (
        <p style={{ fontSize: '12px', color: '#c53030', margin: '6px 4px 0', lineHeight: 1.5 }}>
          ⚠️ 위치 권한 차단됨 — 알림은 발송되지만 지도 링크가 포함되지 않습니다.<br />
          브라우저 설정 → 사이트 권한 → 위치를 허용으로 변경하세요.
        </p>
      )}
      {gpsStatus === 'granted' && (
        <p style={{ fontSize: '12px', color: '#276749', margin: '6px 4px 0' }}>
          📍 위치 권한 허용됨 — 알림 클릭 시 지도로 연결됩니다.
        </p>
      )}
    </div>
  )
}

// 🔔 알림 구독 버튼
function PushBell({ deptId }) {
  const [status, setStatus] = useState('loading') // loading | unsupported | denied | unsubscribed | subscribed
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return }
    getPushStatus(deptId).then(setStatus)
  }, [deptId])

  if (status === 'unsupported' || status === 'loading') return null

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (status === 'subscribed') {
        await unsubscribePush()
        setStatus('unsubscribed')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') { setStatus('denied'); return }
        await subscribePush(deptId)
        setStatus('subscribed')
      }
    } catch (e) {
      alert('알림 설정 실패: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'denied') return (
    <span style={{ fontSize: '11px', color: '#a0aec0', alignSelf: 'center' }}>알림 차단됨</span>
  )

  return (
    <button
      className="admin-toggle-btn"
      onClick={handleClick}
      disabled={busy}
      style={status === 'subscribed' ? {
        background: '#276749', color: '#fff', borderColor: '#276749'
      } : {}}
    >
      {busy ? '...' : status === 'subscribed' ? '🔔 알림켜짐' : '🔕 알림받기'}
    </button>
  )
}

// 부서별 보고서 폼 페이지
function DeptPage({ adminLoggedIn, onShowLogin, onLogout }) {
  const { deptId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState(INITIAL_FORM)

  const decodedDeptId = decodeURIComponent(deptId)
  const dept = getDeptById(decodedDeptId)
  const deptColor = dept?.color || '#1a365d'

  // localStorage 캐시에서 즉시 읽기
  const cacheKey = `deptConfig_${decodedDeptId}`
  const [kakaoLink, setKakaoLink] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey))?.kakaoLink || '' } catch { return '' }
  })

  useEffect(() => {
    // 1순위: 정적 파일 읽기 (프론트엔드 서버에서 제공, 백엔드 슬립과 무관하게 항상 즉시 응답)
    fetch('/kakao-config.json')
      .then(res => res.json())
      .then(config => {
        const staticLink = config[decodedDeptId]?.kakaoLink || ''
        if (staticLink) setKakaoLink(staticLink)
      })
      .catch(() => {})

    // 2순위: 백엔드에서 최신값 조회 (서버가 깨있으면 덮어씀, 슬립 중이면 스킵)
    const API_URL = import.meta.env?.VITE_API_URL || ''
    fetch(`${API_URL}/api/projects?dept=${encodeURIComponent(decodedDeptId)}`)
      .then(res => res.json())
      .then(data => {
        try {
          const prev = JSON.parse(localStorage.getItem(cacheKey)) || {}
          localStorage.setItem(cacheKey, JSON.stringify({
            ...prev,
            kakaoLink: data.kakaoLink || '',
            showDrillMode: data.showDrillMode || false,
          }))
        } catch {}
        if (data.kakaoLink !== undefined) setKakaoLink(data.kakaoLink || '')
      })
      .catch(() => {})
  }, [decodedDeptId])

  const isListPage = location.pathname.endsWith('/list')

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top-bar">
          <button
            className="admin-toggle-btn"
            onClick={() => navigate('/')}
            style={{ fontSize: '13px' }}
          >
            ← 부서선택
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <PushBell deptId={decodedDeptId} />
            {kakaoLink && (
              <a
                href={kakaoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-toggle-btn notify-btn"
              >
                💬 상황알림
              </a>
            )}
            {adminLoggedIn ? (
              <button className="admin-toggle-btn logged-in" onClick={onLogout}>
                로그아웃
              </button>
            ) : (
              <button className="admin-toggle-btn" onClick={onShowLogin}>
                관리자
              </button>
            )}
          </div>
        </div>
        <div className="header-banner">
          <div className="header-line-left" style={{ borderColor: deptColor }} />
          <h1 className="header-title" style={{ color: deptColor }}>사고 발생보고서</h1>
          <div className="header-line-right" style={{ borderColor: deptColor }} />
        </div>
        <div className="header-org">
          <img src="/logo.png" alt="수도권매립지관리공사" className="header-logo" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: deptColor, marginLeft: '6px' }}>
            {decodedDeptId}
          </span>
        </div>
      </header>

      <nav className="bottom-nav">
        <Link
          to={`/dept/${deptId}`}
          className={`nav-item ${!isListPage ? 'active' : ''}`}
        >
          <span className="nav-icon">&#x1F4DD;</span>
          <span>보고서 작성</span>
        </Link>
        <Link
          to={`/dept/${deptId}/list`}
          className={`nav-item ${isListPage ? 'active' : ''}`}
        >
          <span className="nav-icon">&#x1F4CB;</span>
          <span>제출 내역</span>
        </Link>
        {adminLoggedIn && (
          <Link to="/admin" className="nav-item">
            <span className="nav-icon">&#x2699;&#xFE0F;</span>
            <span>관리자</span>
          </Link>
        )}
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={
            <>
              <EmergencyButton deptId={decodedDeptId} />
              <ReportForm
                formData={formData}
                setFormData={setFormData}
                initialForm={INITIAL_FORM}
                deptId={decodedDeptId}
              />
            </>
          } />
          <Route path="/list" element={<ReportList deptId={decodedDeptId} />} />
        </Routes>
      </main>
    </div>
  )
}

// 관리자 페이지 레이아웃
function AdminLayout({ adminLoggedIn, onAuthChange, onLogout }) {
  const navigate = useNavigate()
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top-bar">
          <button
            className="admin-toggle-btn"
            onClick={() => navigate('/')}
            style={{ fontSize: '13px' }}
          >
            ← 부서선택
          </button>
          {adminLoggedIn && (
            <button className="admin-toggle-btn logged-in" onClick={onLogout}>
              로그아웃
            </button>
          )}
        </div>
        <div className="header-banner">
          <div className="header-line-left" />
          <h1 className="header-title">관리자 설정</h1>
          <div className="header-line-right" />
        </div>
        <div className="header-org">
          <img src="/logo.png" alt="수도권매립지관리공사" className="header-logo" />
        </div>
      </header>
      <main className="app-main">
        {adminLoggedIn
          ? <AdminPage onAuthChange={onAuthChange} />
          : <AdminLogin onLogin={onAuthChange} />
        }
      </main>
    </div>
  )
}

function App() {
  const [adminLoggedIn, setAdminLoggedIn] = useState(isAdmin())
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleAdminChange = () => {
    setAdminLoggedIn(isAdmin())
    setShowLoginModal(false)
  }

  const handleLogout = () => {
    logoutAdmin()
    setAdminLoggedIn(false)
  }

  return (
    <>
      <Routes>
        <Route path="/" element={
          <DepartmentSelect
            adminLoggedIn={adminLoggedIn}
            onShowLogin={() => setShowLoginModal(true)}
            onLogout={handleLogout}
          />
        } />
        <Route path="/dept/:deptId/*" element={
          <DeptPage
            adminLoggedIn={adminLoggedIn}
            onShowLogin={() => setShowLoginModal(true)}
            onLogout={handleLogout}
          />
        } />
        <Route path="/admin" element={
          <AdminLayout
            adminLoggedIn={adminLoggedIn}
            onAuthChange={handleAdminChange}
            onLogout={handleLogout}
          />
        } />
      </Routes>

      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <AdminLogin onLogin={handleAdminChange} />
            <button
              className="modal-btn"
              onClick={() => setShowLoginModal(false)}
              style={{ background: '#edf2f7', color: '#4a5568', marginTop: '8px' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default App
