import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import ReportForm from './components/ReportForm'
import AdminPage from './components/AdminPage'
import ReportList from './components/ReportList'
import AdminLogin from './components/AdminLogin'
import DepartmentSelect from './components/DepartmentSelect'
import { getDeptById } from './config/departments'
import { isAdmin, logoutAdmin } from './utils/auth'
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
          <div style={{ display: 'flex', gap: '8px' }}>
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
            <ReportForm
              formData={formData}
              setFormData={setFormData}
              initialForm={INITIAL_FORM}
              deptId={decodedDeptId}
            />
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
