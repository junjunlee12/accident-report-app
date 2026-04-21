/**
 * 사업명 및 소속 기본 설정
 *
 * 이 파일은 서버에 저장된 설정이 없을 때 사용되는 기본값입니다.
 * 관리자 페이지에서 수정하면 서버(MongoDB)에 저장되며,
 * 이후 모든 사용자에게 해당 설정이 적용됩니다.
 */

export const DEFAULT_PROJECTS = [
  {
    name: '수도권매립지관리공사',
    companies: [
      { label: '매립운영처', base: '매립운영처' },
      { label: '주민감시요원', base: '주민감시요원' },
    ],
  },
  {
    name: '제3매립장(1단계) 매립작업 및 부대공사',
    companies: [
      { label: '(주)대우건설(하도급 포함)', base: '(주)대우건설' },
    ],
  },
  {
    name: '수도권매립지 계측관리 용역',
    companies: [
      { label: '(주)테스콤(하도급 포함)', base: '(주)테스콤' },
    ],
  },
  {
    name: '통합계량대 인프라 유지관리용역',
    companies: [
      { label: '(주)투비콤(하도급 포함)', base: '(주)투비콤' },
    ],
  },
]

// 업무용차량사고는 사업명 목록에는 없지만 수신자 설정용 특별 항목
export const SPECIAL_RECIPIENT_KEYS = ['업무용차량사고']

// 사업명 목록만 추출 (드롭다운용)
export function getProjectNames(projects) {
  return (projects || DEFAULT_PROJECTS).map(p => p.name)
}

// 사업명별 소속 목록 추출
export function getCompaniesByProject(projects, projectName) {
  const list = projects || DEFAULT_PROJECTS
  const project = list.find(p => p.name === projectName)
  return project?.companies || []
}

// 모든 수신자 키 목록 (사업명 + 특별 항목)
export function getAllRecipientKeys(projects) {
  const projectNames = getProjectNames(projects)
  return [...SPECIAL_RECIPIENT_KEYS, ...projectNames]
}
