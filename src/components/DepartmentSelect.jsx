import { useNavigate } from 'react-router-dom'
import { DEPT_GROUPS, getDeptById } from '../config/departments'

export default function DepartmentSelect({ adminLoggedIn, onShowLogin, onLogout }) {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <header style={{
        background: '#1a365d', color: 'white', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="수도권매립지관리공사" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.3px' }}>
            사고 보고 시스템
          </span>
        </div>
        <div>
          {adminLoggedIn ? (
            <button
              onClick={onLogout}
              style={{
                padding: '6px 14px', background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px',
                color: 'white', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              로그아웃
            </button>
          ) : (
            <button
              onClick={onShowLogin}
              style={{
                padding: '6px 14px', background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px',
                color: 'white', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              관리자
            </button>
          )}
        </div>
      </header>

      {/* 본문 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
        <p style={{
          fontSize: '15px', color: '#4a5568', fontWeight: '600',
          marginBottom: '28px', textAlign: 'center', letterSpacing: '-0.2px'
        }}>
          ※ 소속 부서를 선택하세요.
        </p>

        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {DEPT_GROUPS.map((group, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {group.map(deptId => {
                const dept = getDeptById(deptId)
                const color = dept?.color || '#1a365d'
                return (
                  <button
                    key={deptId}
                    onClick={() => navigate(`/dept/${encodeURIComponent(deptId)}`)}
                    style={{
                      flex: 1,
                      padding: '14px 8px',
                      background: 'white',
                      border: `2.5px solid ${color}`,
                      borderRadius: '12px',
                      color: color,
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '-0.3px',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = color
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.color = color
                    }}
                  >
                    {deptId}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {adminLoggedIn && (
          <button
            onClick={() => navigate('/admin')}
            style={{
              marginTop: '32px', padding: '10px 28px',
              background: '#1a365d', color: 'white',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            관리자 페이지
          </button>
        )}
      </main>
    </div>
  )
}
