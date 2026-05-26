import { useNavigate } from 'react-router-dom'
import { DEPT_GROUPS, getDeptById } from '../config/departments'

export default function DepartmentSelect({ adminLoggedIn, onShowLogin, onLogout }) {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f0', display: 'flex', flexDirection: 'column' }}>

      {/* ── 헤더 배너 ── */}
      <header>
        {/* 최상단 바: 관리자/로그아웃 버튼만 (배너와 동일 배경색) */}
        <div style={{
          background: '#EEE9D5',
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '7px 14px',
        }}>
          {adminLoggedIn ? (
            <button
              onClick={onLogout}
              style={{
                padding: '4px 12px',
                background: 'rgba(0,0,0,0.10)',
                border: '1px solid rgba(0,0,0,0.18)',
                borderRadius: '5px',
                color: '#333',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              로그아웃
            </button>
          ) : (
            <button
              onClick={onShowLogin}
              style={{
                padding: '4px 12px',
                background: 'rgba(0,0,0,0.07)',
                border: '1px solid rgba(0,0,0,0.13)',
                borderRadius: '5px',
                color: '#555',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              관리자
            </button>
          )}
        </div>

        {/* 배너 이미지 + 텍스트 오버레이 (마스코트와 같은 높이) */}
        <div style={{ position: 'relative' }}>
          <img
            src="/main-banner-2.png"
            alt="수도권매립지관리공사"
            style={{ width: '100%', display: 'block' }}
          />
          {/* 우측 빈 공간에 텍스트 - 마스코트 높이 기준 세로 배치 */}
          <div style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            textAlign: 'right',
          }}>
            <div style={{
              color: '#1a90c8',
              fontSize: '20px',
              fontWeight: '800',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
            }}>
              수도권매립지관리공사
            </div>
            <div style={{
              color: '#555',
              fontSize: '14px',
              fontWeight: '600',
              marginTop: '5px',
              letterSpacing: '-0.2px',
            }}>
              사고 보고 시스템
            </div>
          </div>
        </div>
      </header>

      {/* ── 부서 선택 본문 ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 40px',
      }}>
        <p style={{
          fontSize: '14px',
          color: '#555',
          fontWeight: '600',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          ※ 소속 부서를 선택하세요.
        </p>

        {/* 버튼 그리드: 모든 버튼을 동일 너비(1/3)로 고정 */}
        <div style={{ width: '100%', maxWidth: '480px' }}>
          {DEPT_GROUPS.map((group, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              {group.map(deptId => {
                const dept = getDeptById(deptId)
                const color = dept?.color || '#1a365d'
                return (
                  <button
                    key={deptId}
                    onClick={() => navigate(`/dept/${encodeURIComponent(deptId)}`)}
                    style={{
                      /* 행에 몇 개든 항상 1/3 너비로 고정 */
                      width: 'calc((100% - 20px) / 3)',
                      flexShrink: 0,
                      padding: '14px 6px',
                      background: 'white',
                      border: `2.5px solid ${color}`,
                      borderRadius: '12px',
                      color: color,
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '-0.3px',
                      transition: 'background 0.15s, color 0.15s',
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
              marginTop: '28px',
              padding: '10px 28px',
              background: '#1a365d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            관리자 페이지
          </button>
        )}
      </main>
    </div>
  )
}
