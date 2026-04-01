import { useState } from 'react'
import { loginAdmin } from '../utils/auth'

export default function AdminLogin({ onLogin }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (loginAdmin(id, password)) {
      onLogin()
    } else {
      setError('아이디 또는 비밀번호가 일치하지 않습니다.')
      setPassword('')
    }
  }

  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x1F512;</div>
      <h2 style={{ fontSize: '17px', color: '#1a365d', marginBottom: '6px' }}>
        관리자 로그인
      </h2>
      <p style={{ fontSize: '12px', color: '#718096', marginBottom: '20px', lineHeight: 1.5 }}>
        관리자 계정으로 로그인하세요.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="form-input"
          placeholder="아이디"
          value={id}
          onChange={e => { setId(e.target.value); setError('') }}
          style={{ maxWidth: '260px', margin: '0 auto 10px', textAlign: 'center' }}
          autoComplete="username"
        />
        <input
          type="password"
          className="form-input"
          placeholder="비밀번호"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          style={{ maxWidth: '260px', margin: '0 auto 12px', textAlign: 'center' }}
          autoComplete="current-password"
        />
        {error && (
          <p style={{ color: '#e53e3e', fontSize: '12px', marginBottom: '10px' }}>{error}</p>
        )}
        <button
          type="submit"
          className="submit-btn"
          style={{ maxWidth: '260px', margin: '0 auto', padding: '12px' }}
        >
          로그인
        </button>
      </form>
    </div>
  )
}
