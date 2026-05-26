export const DEPARTMENTS = [
  { id: '안전환경실', color: '#C05A28' },
  { id: 'ESG전략실', color: '#C05A28' },
  { id: '홍보비서실', color: '#C05A28' },
  { id: '기획조정처', color: '#B8860B' },
  { id: '경영지원처', color: '#B8860B' },
  { id: '매립시설처', color: '#1a56a0' },
  { id: '매립운영처', color: '#1a56a0' },
  { id: '물환경처', color: '#1a56a0' },
  { id: '자원사업처', color: '#276749' },
  { id: '탄소사업처', color: '#276749' },
  { id: '에너지사업처', color: '#276749' },
  { id: '지역상생처', color: '#2D3748' },
  { id: '체육공원처', color: '#2D3748' },
  { id: '기술정보처', color: '#00A3C4' },
  { id: '연구분석처', color: '#00A3C4' },
]

// 그룹별 배열 (부서선택 화면에서 행 배치용)
export const DEPT_GROUPS = [
  ['안전환경실', 'ESG전략실', '홍보비서실'],
  ['기획조정처', '경영지원처'],
  ['매립시설처', '매립운영처', '물환경처'],
  ['자원사업처', '탄소사업처', '에너지사업처'],
  ['지역상생처', '체육공원처'],
  ['기술정보처', '연구분석처'],
]

export function getDeptById(id) {
  return DEPARTMENTS.find(d => d.id === id) || null
}
