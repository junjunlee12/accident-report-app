import { useState, useRef, useEffect } from 'react'
import { getAdminToken } from '../utils/auth'
import { DEPARTMENTS, DEPT_GROUPS } from '../config/departments'

const PRESET_COLORS = [
  '#C05A28', '#B8860B', '#1a56a0', '#276749',
  '#2D3748', '#00A3C4', '#e53e3e', '#805ad5',
]

function getDefaultDepts() {
  const result = []
  DEPT_GROUPS.forEach((group, gIdx) => {
    group.forEach((deptId, dIdx) => {
      const dept = DEPARTMENTS.find(d => d.id === deptId)
      result.push({
        id: deptId,
        color: dept?.color || '#1a365d',
        rowStart: gIdx > 0 && dIdx === 0,
      })
    })
  })
  return result
}

export default function DeptManager() {
  const [depts, setDepts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const listRef = useRef(null)
  const touchState = useRef({ dragging: false, startIdx: null, overIdx: null })

  useEffect(() => { loadConfig() }, [])

  // non-passive touchmove to prevent scroll during drag
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const handler = (e) => { if (touchState.current.dragging) e.preventDefault() }
    el.addEventListener('touchmove', handler, { passive: false })
    return () => el.removeEventListener('touchmove', handler)
  }, [depts])

  const loadConfig = async () => {
    setLoading(true)
    const API_URL = import.meta.env?.VITE_API_URL || ''
    try {
      const res = await fetch(`${API_URL}/api/dept-config`)
      const data = await res.json()
      setDepts(data.success && data.departments ? data.departments : getDefaultDepts())
    } catch {
      setDepts(getDefaultDepts())
    }
    setLoading(false)
  }

  const saveConfig = async () => {
    setSaving(true)
    const API_URL = import.meta.env?.VITE_API_URL || ''
    try {
      const res = await fetch(`${API_URL}/api/dept-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() },
        body: JSON.stringify({ departments: depts })
      })
      const data = await res.json()
      if (data.success) {
        alert('부서 설정이 저장되었습니다.')
        // 캐시 업데이트
        localStorage.setItem('dept_config_cache', JSON.stringify({ departments: depts, ts: Date.now() }))
      } else {
        alert('저장 실패: ' + data.message)
      }
    } catch (e) {
      alert('저장 실패: ' + e.message)
    }
    setSaving(false)
  }

  const reorder = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const arr = [...depts]
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)
    setDepts(arr)
  }

  const moveUp = (idx) => { if (idx > 0) reorder(idx, idx - 1) }
  const moveDown = (idx) => { if (idx < depts.length - 1) reorder(idx, idx + 1) }

  // Touch drag handlers
  const handleTouchStart = (e, idx) => {
    touchState.current = { dragging: true, startIdx: idx }
    setDragIdx(idx)
  }

  const handleTouchMove = (e) => {
    if (!touchState.current.dragging) return
    const touch = e.touches[0]
    const el = listRef.current
    if (!el) return
    const items = el.querySelectorAll('[data-drag-item]')
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const idx = parseInt(item.dataset.dragItem)
        if (!isNaN(idx)) {
          touchState.current.overIdx = idx
          setDragOverIdx(idx)
        }
        break
      }
    }
  }

  const handleTouchEnd = () => {
    const { startIdx, overIdx } = touchState.current
    if (startIdx !== null && overIdx !== null) reorder(startIdx, overIdx)
    touchState.current = { dragging: false, startIdx: null, overIdx: null }
    setDragIdx(null)
    setDragOverIdx(null)
  }

  // Mouse drag handlers
  const handleDragStart = (e, idx) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDrop = (idx) => {
    if (dragIdx !== null) reorder(dragIdx, idx)
    setDragIdx(null)
    setDragOverIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null) }

  const updateName = (idx, name) => {
    const arr = [...depts]
    arr[idx] = { ...arr[idx], id: name }
    setDepts(arr)
  }

  const updateColor = (idx, color) => {
    const arr = [...depts]
    arr[idx] = { ...arr[idx], color }
    setDepts(arr)
  }

  const toggleRowStart = (idx) => {
    if (idx === 0) return
    const arr = [...depts]
    arr[idx] = { ...arr[idx], rowStart: !arr[idx].rowStart }
    setDepts(arr)
  }

  const removeDept = (idx) => {
    if (!confirm(`"${depts[idx].id}" 부서를 삭제하시겠습니까?`)) return
    setDepts(depts.filter((_, i) => i !== idx))
  }

  const addDept = () => {
    setDepts([...depts, { id: '새 부서', color: '#1a56a0' }])
  }

  if (loading) return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#718096', fontSize: '13px' }}>로딩 중...</div>
  )
  if (!depts) return null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', color: '#a0aec0', margin: 0 }}>
          ≡ 드래그 또는 ↑↓ 버튼으로 순서 변경 · ↵ 버튼으로 줄바꿈 설정
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={addDept}
            style={{ padding: '5px 12px', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', color: '#2b6cb0' }}
          >
            + 부서 추가
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            style={{ padding: '5px 12px', background: '#1a365d', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div ref={listRef} style={{ userSelect: 'none' }}>
        {depts.map((dept, idx) => (
          <div key={`${dept.id}-${idx}`}>
            {idx > 0 && dept.rowStart && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0', color: '#a0aec0', fontSize: '10px' }}>
                <div style={{ flex: 1, borderTop: '2px dashed #cbd5e0' }} />
                <span>↵ 새 행</span>
                <div style={{ flex: 1, borderTop: '2px dashed #cbd5e0' }} />
              </div>
            )}
            <div
              data-drag-item={idx}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={e => handleTouchStart(e, idx)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 8px', marginBottom: '3px',
                border: dragOverIdx === idx && dragIdx !== idx
                  ? '2px dashed #1a365d' : '1px solid #e2e8f0',
                borderRadius: '7px',
                background: dragIdx === idx ? '#ebf8ff' : 'white',
                opacity: dragIdx === idx ? 0.6 : 1,
                touchAction: 'none',
                cursor: 'grab',
              }}
            >
              {/* 드래그 핸들 */}
              <span style={{ color: '#cbd5e0', fontSize: '15px', flexShrink: 0 }}>⠿</span>

              {/* 부서명 입력 */}
              <input
                type="text"
                value={dept.id}
                onChange={e => updateName(idx, e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                style={{
                  flex: 1, padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: '4px',
                  fontSize: '13px', fontFamily: 'inherit', fontWeight: '700',
                  color: dept.color, minWidth: 0, cursor: 'text'
                }}
              />

              {/* 색상 스와치 */}
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => updateColor(idx, c)}
                    style={{
                      width: '14px', height: '14px', borderRadius: '50%', background: c,
                      border: dept.color === c ? '2px solid #1a365d' : '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer', padding: 0, flexShrink: 0
                    }}
                  />
                ))}
              </div>

              {/* 줄바꿈 토글 */}
              {idx > 0 && (
                <button
                  onClick={() => toggleRowStart(idx)}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  title={dept.rowStart ? '이 위 줄바꿈 제거' : '이 위 줄바꿈 추가'}
                  style={{
                    padding: '2px 5px', border: `1px solid ${dept.rowStart ? '#1a365d' : '#e2e8f0'}`,
                    borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontFamily: 'inherit',
                    background: dept.rowStart ? '#ebf4ff' : 'white',
                    color: dept.rowStart ? '#1a365d' : '#cbd5e0', flexShrink: 0, fontWeight: '700'
                  }}
                >
                  ↵
                </button>
              )}

              {/* 위/아래 이동 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  style={{ padding: '1px 4px', fontSize: '9px', border: '1px solid #e2e8f0', borderRadius: '3px', cursor: idx === 0 ? 'default' : 'pointer', background: 'white', color: idx === 0 ? '#e2e8f0' : '#4a5568', fontFamily: 'inherit', lineHeight: 1.2 }}
                >▲</button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === depts.length - 1}
                  style={{ padding: '1px 4px', fontSize: '9px', border: '1px solid #e2e8f0', borderRadius: '3px', cursor: idx === depts.length - 1 ? 'default' : 'pointer', background: 'white', color: idx === depts.length - 1 ? '#e2e8f0' : '#4a5568', fontFamily: 'inherit', lineHeight: 1.2 }}
                >▼</button>
              </div>

              {/* 삭제 */}
              <button
                onClick={() => removeDept(idx)}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                style={{
                  padding: '2px 6px', background: '#fff5f5', border: '1px solid #fed7d7',
                  borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                  color: '#e53e3e', flexShrink: 0
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
