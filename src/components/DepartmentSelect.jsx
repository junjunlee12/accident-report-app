import { useNavigate } from 'react-router-dom'
import { DEPT_GROUPS, getDeptById } from '../config/departments'

export default function DepartmentSelect({ adminLoggedIn, onShowLogin, onLogout }) {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f0', display: 'flex', flexDirection: 'column' }}>

      {/* ── 헤더 배너 ── */}
      <header style={{ background: '#EDE8DC', position: 'relative' }}>
        {/* 관리자 버튼 (우상단 절대 배치) */}
        <div style={{ position: 'absolute', top: '10px', right: '14px', zIndex: 10 }}>
          {adminLoggedIn ? (
            <button
              onClick={onLogout}
              style={{
                padding: '5px 12px', background: 'rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.2)', borderRadius: '6px',
                color: '#333', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              로그아웃
            </button>
          ) : (
            <button
              onClick={onShowLogin}
              style={{
                padding: '5px 12px', background: 'rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px',
                color: '#555', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              관리자
            </button>
          )}
        </div>

        {/* 배너 이미지 전체 너비 */}
        <div style={{ position: 'relative' }}>
          <img
            src="/main-banner.png"
            alt="수도권매립지관리공사"
            style={{ width: '100%', display: 'block' }}
          />
          {/* 이미지 우측 여백 위에 텍스트 오버레이 */}
          <div style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            textAlign: 'right',
          }}>
            <div style={{
              color: '#1a90c8',
              fontSize: '22px',
              fontWeight: '800',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
            }}>
              수도권매립지관리공사
            </div>
            <div style={{
              color: '#444',
              fontSize: '15px',
              fontWeight: '600',
              marginTop: '4px',
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
