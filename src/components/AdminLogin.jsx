import { useState } from 'react'
import { loginAdmin, loginDeptAdmin, applyDeptAdmin } from '../utils/auth'
import { DEPARTMENTS } from '../config/departments'

export default function AdminLogin({ onLogin }) {
  const [tab, setTab] = useState('super') // 'super' | 'dept' | 'apply'
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [deptId, setDeptId] = useState(DEPARTMENTS[0].id)
  const [pwConfirm, setPwConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => { setId(''); setPassword(''); setPwConfirm(''); setError(''); setSuccess('') }

  const handleSuperLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const result = await loginAdmin(id, password)
      if (result.success) { onLogin() }
      else { setError(result.message); setPassword('') }
    } finally { setLoading(false) }
  }

  const handleDeptLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const result = await loginDeptAdmin(deptId, id, password)
      if (result.success) { onLogin() }
      else { setError(result.message); setPassword('') }
    } finally { setLoading(false) }
  }

  const handleApply = async (e) => {
    e.preventDefault()
    if (password !== pwConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 4) { setError('비밀번호는 4자 이상이어야 합니다.'); return }
    setLoading(true); setError('')
    try {
      const result = await applyDeptAdmin(deptId, id, password)
      if (result.success) {
        setSuccess(result.message)
        reset()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('서버 연결 실패: ' + err.message)
    } finally { setLoading(false) }
  }

  const tabStyle = (t) => ({
    flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: tab === t ? '700' : '500',
    background: tab === t ? '#1a365d' : '#edf2f7', color: tab === t ? '#fff' : '#4a5568',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    borderRadius: t === 'super' ? '6px 0 0 6px' : t === 'apply' ? '0 6px 6px 0' : '0',
    transition: 'all 0.15s'
  })

  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <div style={{ fontSize: '36px', marginBottom: '10px' }}>&#x1F512;</div>

      {/* 탭 */}
      <div style={{ display: 'flex', maxWidth: '280px', margin: '0 auto 20px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <button style={tabStyle('super')} onClick={() => { setTab('super'); reset() }}>슈퍼관리자</button>
        <button style={tabStyle('dept')} onClick={() => { setTab('dept'); reset() }}>부서 관리자</button>
        <button style={tabStyle('apply')} onClick={() => { setTab('apply'); reset() }}>관리자 신청</button>
      </div>

      {/* 슈퍼관리자 로그인 */}
      {tab === 'super' && (
        <form onSubmit={handleSuperLogin}>
          <p style={{ fontSize: '12px', color: '#718096', marginBottom: '16px' }}>
            전체 부서를 관리하는 슈퍼관리자 계정으로 로그인합니다.
          </p>
          <input type="text" className="form-input" placeholder="아이디"
            value={id} onChange={e => { setId(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }} autoComplete="username" />
          <input type="password" className="form-input" placeholder="비밀번호"
            value={password} onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 12px', textAlign: 'center' }} autoComplete="current-password" />
          {error && <p style={{ color: '#e53e3e', fontSize: '12px', marginBottom: '10px' }}>{error}</p>}
          <button type="submit" className="submit-btn" disabled={loading}
            style={{ maxWidth: '260px', margin: '0 auto', padding: '12px' }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      )}

      {/* 부서 관리자 로그인 */}
      {tab === 'dept' && (
        <form onSubmit={handleDeptLogin}>
          <p style={{ fontSize: '12px', color: '#718096', marginBottom: '16px' }}>
            담당 부서의 관리자 계정으로 로그인합니다.
          </p>
          <select className="form-select" value={deptId} onChange={e => { setDeptId(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }}>
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
          </select>
          <input type="text" className="form-input" placeholder="아이디"
            value={id} onChange={e => { setId(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }} autoComplete="username" />
          <input type="password" className="form-input" placeholder="비밀번호"
            value={password} onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 12px', textAlign: 'center' }} autoComplete="current-password" />
          {error && <p style={{ color: '#e53e3e', fontSize: '12px', marginBottom: '10px' }}>{error}</p>}
          <button type="submit" className="submit-btn" disabled={loading}
            style={{ maxWidth: '260px', margin: '0 auto', padding: '12px' }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      )}

      {/* 부서 관리자 신청 */}
      {tab === 'apply' && (
        <form onSubmit={handleApply}>
          <p style={{ fontSize: '12px', color: '#718096', marginBottom: '16px' }}>
            사용할 부서와 아이디·비밀번호를 입력하세요.<br />
            슈퍼관리자 승인 후 로그인 가능합니다.
          </p>
          <select className="form-select" value={deptId} onChange={e => { setDeptId(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }}>
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
          </select>
          <input type="text" className="form-input" placeholder="사용할 아이디"
            value={id} onChange={e => { setId(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }} />
          <input type="password" className="form-input" placeholder="비밀번호 (4자 이상)"
            value={password} onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }} />
          <input type="password" className="form-input" placeholder="비밀번호 확인"
            value={pwConfirm} onChange={e => { setPwConfirm(e.target.value); setError('') }}
            style={{ maxWidth: '260px', margin: '0 auto 12px', textAlign: 'center' }} />
          {error && <p style={{ color: '#e53e3e', fontSize: '12px', marginBottom: '10px' }}>{error}</p>}
          {success && <p style={{ color: '#276749', fontSize: '12px', marginBottom: '10px', fontWeight: '600' }}>{success}</p>}
          <button type="submit" className="submit-btn" disabled={loading}
            style={{ maxWidth: '260px', margin: '0 auto', padding: '12px', background: '#276749' }}>
            {loading ? '신청 중...' : '관리자 신청'}
          </button>
        </form>
      )}
    </div>
  )
}
