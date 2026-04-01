export default function Logo({ size = 32 }) {
  // 수도권매립지관리공사 로고 재현 (십자 모양 4색 블록)
  const s = size
  const half = s / 2
  const gap = s * 0.04

  return (
    <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 상단 중앙 - 파란색 */}
      <rect x="38" y="2" width="28" height="28" rx="2" fill="#0068B7" />
      {/* 좌측 중앙 - 초록색 */}
      <rect x="4" y="38" width="28" height="28" rx="2" fill="#009944" />
      {/* 중앙 - 연한 초록 */}
      <rect x="38" y="38" width="28" height="28" rx="2" fill="#8FC31F" />
      {/* 우측 중앙 - 진한 파랑 */}
      <rect x="72" y="38" width="28" height="28" rx="2" fill="#005BAC" />
      {/* 하단 중앙 - 하늘색 */}
      <rect x="38" y="72" width="28" height="28" rx="2" fill="#00A0E9" />
    </svg>
  )
}
