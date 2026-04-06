import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import ReportForm from './components/ReportForm'
import AdminPage from './components/AdminPage'
import ReportList from './components/ReportList'
import AdminLogin from './components/AdminLogin'
import { isAdmin, logoutAdmin } from './utils/auth'
import './App.css'

const INITIAL_FORM = {
  isVehicleAccident: false, vehicleNumber: '',
  projectName: '', company: '', subContractor: '', location: '',
  date: '', time: '', rank: '', name: '', phone: '', birthDate: '',
  workExperienceYears: '', workExperienceMonths: '',
  description: '', damageHuman: false, damageHumanDetail: '',
  damageProperty: false, damagePropertyDetail: '',
  action: '', photos: [],
}

function App() {
  const location = useLocation()
  const [adminLoggedIn, setAdminLoggedIn] = useState(isAdmin())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM)

  const handleAdminChange = () => {
    setAdminLoggedIn(isAdmin())
    setShowLoginModal(false)
  }

  const handleLogout = () => {
    logoutAdmin()
    setAdminLoggedIn(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top-bar">
          {adminLoggedIn ? (
            <button className="admin-toggle-btn logged-in" onClick={handleLogout}>
              로그아웃
            </button>
          ) : (
            <button className="admin-toggle-btn" onClick={() => setShowLoginModal(true)}>
              관리자
            </button>
          )}
        </div>
        <div className="header-banner">
          <div className="header-line-left" />
          <h1 className="header-title">사고 발생보고서</h1>
          <div className="header-line-right" />
        </div>
        <div className="header-org">
          <img src="/logo.png" alt="수도권매립지관리공사" className="header-logo" />
        </div>
      </header>

      <nav className="bottom-nav">
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <span className="nav-icon">&#x1F4DD;</span>
          <span>보고서 작성</span>
        </Link>
        <Link to="/list" className={`nav-item ${location.pathname === '/list' ? 'active' : ''}`}>
          <span className="nav-icon">&#x1F4CB;</span>
          <span>제출 내역</span>
        </Link>
        {adminLoggedIn && (
          <Link to="/admin" className={`nav-item ${location.pathname === '/admin' ? 'active' : ''}`}>
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
            />
          } />
          <Route path="/list" element={<ReportList />} />
          <Route path="/admin" element={
            adminLoggedIn
              ? <AdminPage onAuthChange={handleAdminChange} />
              : <AdminLogin onLogin={handleAdminChange} />
          } />
        </Routes>
      </main>

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
    </div>
  )
}

export default App
