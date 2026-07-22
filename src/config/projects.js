/**
 * 사업명 및 소속 기본 설정
 *
 * 이 파일은 서버에 저장된 설정이 없을 때 사용되는 기본값입니다.
 * 관리자 페이지에서 수정하면 서버(MongoDB)에 저장되며,
 * 이후 모든 사용자에게 해당 설정이 적용됩니다.
 */

// 부서별 사업명/소속은 관리자 페이지에서 설정 후 MongoDB에 저장
// 서버에 설정이 없는 부서는 빈 상태에서 시작 (매립운영처 데이터가 다른 부서에 노출되지 않도록)
export const DEFAULT_PROJECTS = []

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
// 사업명이 하나도 없으면 빈 배열 반환 (미설정 부서에 업무용차량사고가 노출되지 않도록)
export function getAllRecipientKeys(projects) {
  const projectNames = getProjectNames(projects)
  if (!projectNames.length) return []
  return [...SPECIAL_RECIPIENT_KEYS, ...projectNames]
}
