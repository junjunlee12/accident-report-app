import jsPDF from 'jspdf'

// 보고서 유형에 따라 분기
export async function generatePDF(report) {
  if (report.isVehicleAccident) {
    return generateVehiclePDF(report)
  }
  return generateAccidentPDF(report)
}

// ===== 산업재해 발생보고서 PDF =====
async function generateAccidentPDF(report) {
  // 한글 폰트 로드
  const doc = new jsPDF('p', 'mm', 'a4')

  // 기본 폰트로는 한글 출력이 안 되므로, HTML Canvas 기반으로 PDF 생성
  const canvas = document.createElement('canvas')
  const scale = 3
  const pageWidth = 210 // A4 mm
  const pageHeight = 297
  canvas.width = pageWidth * scale
  canvas.height = pageHeight * scale
  const ctx = canvas.getContext('2d')

  // 배경
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const mm = (val) => val * scale
  let y = 15

  // 헬퍼 함수
  const drawText = (text, x, yPos, options = {}) => {
    const { fontSize = 10, fontWeight = 'normal', color = '#000', align = 'left', maxWidth } = options
    ctx.font = `${fontWeight} ${mm(fontSize * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = align

    if (maxWidth) {
      wrapText(ctx, text, mm(x), mm(yPos), mm(maxWidth), mm(fontSize * 0.45))
    } else {
      ctx.fillText(text, mm(x), mm(yPos))
    }
    ctx.textAlign = 'left'
  }

  const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
    const words = text.split('')
    let line = ''
    let currentY = y

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i]
      const metrics = context.measureText(testLine)
      if (metrics.width > maxWidth && i > 0) {
        context.fillText(line, x, currentY)
        line = words[i]
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    context.fillText(line, x, currentY)
    return currentY
  }

  const drawLine = (x1, y1, x2, y2, width = 0.5) => {
    ctx.beginPath()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = mm(width)
    ctx.moveTo(mm(x1), mm(y1))
    ctx.lineTo(mm(x2), mm(y2))
    ctx.stroke()
  }

  const drawRect = (x, yPos, w, h) => {
    ctx.strokeStyle = '#000'
    ctx.lineWidth = mm(0.3)
    ctx.strokeRect(mm(x), mm(yPos), mm(w), mm(h))
  }

  const drawFilledRect = (x, yPos, w, h, color) => {
    ctx.fillStyle = color
    ctx.fillRect(mm(x), mm(yPos), mm(w), mm(h))
  }

  // 제목
  drawFilledRect(15, y, 180, 10, '#1a365d')
  drawText('재난(산업재해) 발생보고서', 105, y + 7.5, {
    fontSize: 16, fontWeight: 'bold', color: '#ffffff', align: 'center'
  })
  y += 16

  // 테이블 시작
  const leftCol = 15
  const labelWidth = 30
  const contentStart = leftCol + labelWidth
  const tableWidth = 180
  const contentWidth = tableWidth - labelWidth
  const rowHeight = 10

  // 행 그리기 헬퍼
  const drawRow = (label, content, height = rowHeight, yStart = y) => {
    drawRect(leftCol, yStart, tableWidth, height)
    drawRect(leftCol, yStart, labelWidth, height)
    drawFilledRect(leftCol + 0.15, yStart + 0.15, labelWidth - 0.3, height - 0.3, '#f0f4f8')
    drawText(label, leftCol + 3, yStart + height / 2 + 1.5, { fontSize: 10, fontWeight: 'bold' })
    drawText(content, contentStart + 3, yStart + height / 2 + 1.5, { fontSize: 10 })
    y = yStart + height
  }

  // 1. 소속
  drawRow('소 속', report.displayCompany || report.company || '')

  // 2. 발생장소
  drawRow('발생장소', report.location || '')

  // 3. 일시
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  let dateDisplay = ''
  if (report.date) {
    const d = new Date(report.date)
    const dayOfWeek = dayNames[d.getDay()]
    dateDisplay = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${report.time || ''} ${dayOfWeek}요일`
  }
  drawRow('일 시', dateDisplay)

  // 4. 인적사항
  const personHeight = 16
  drawRect(leftCol, y, tableWidth, personHeight)
  drawRect(leftCol, y, labelWidth, personHeight)
  drawFilledRect(leftCol + 0.15, y + 0.15, labelWidth - 0.3, personHeight - 0.3, '#f0f4f8')
  drawText('인적사항', leftCol + 3, y + 6, { fontSize: 10, fontWeight: 'bold' })

  // 인적사항 내용
  drawText(`소속: ${report.company || ''}`, contentStart + 3, y + 5, { fontSize: 9 })
  drawText(`직급: ${report.rank || ''}  성명: ${report.name || ''}  생년월일: ${report.birthDate || ''}`, contentStart + 3, y + 11, { fontSize: 9 })
  const expText = `동업무경력: ${report.workExperienceYears || '0'}년 ${report.workExperienceMonths || '0'}월`
  drawText(expText, contentStart + 100, y + 11, { fontSize: 9 })
  y += personHeight

  // 5. 발생경위
  const autoDesc = buildAutoDescription(report)
  const fullDesc = autoDesc + (report.description ? ' ' + report.description : '')
  const descHeight = Math.max(40, Math.ceil(fullDesc.length / 30) * 6 + 10)

  drawRect(leftCol, y, tableWidth, descHeight)
  drawRect(leftCol, y, labelWidth, descHeight)
  drawFilledRect(leftCol + 0.15, y + 0.15, labelWidth - 0.3, descHeight - 0.3, '#f0f4f8')
  drawText('발생경위', leftCol + 3, y + 6, { fontSize: 10, fontWeight: 'bold' })

  // 발생경위 텍스트 래핑
  ctx.font = `normal ${mm(9 * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
  ctx.fillStyle = '#000'
  wrapText(ctx, fullDesc, mm(contentStart + 3), mm(y + 6), mm(contentWidth - 6), mm(5))
  y += descHeight

  // 6. 피해정도
  let damageText = ''
  if (report.damageHuman) damageText += `[인명피해] ${report.damageHumanDetail || ''}\n`
  if (report.damageProperty) damageText += `[물적피해] ${report.damagePropertyDetail || ''}`
  if (!damageText) damageText = '해당없음'
  const damageHeight = 16
  drawRect(leftCol, y, tableWidth, damageHeight)
  drawRect(leftCol, y, labelWidth, damageHeight)
  drawFilledRect(leftCol + 0.15, y + 0.15, labelWidth - 0.3, damageHeight - 0.3, '#f0f4f8')
  drawText('피해정도', leftCol + 3, y + 6, { fontSize: 10, fontWeight: 'bold' })
  const damageLines = damageText.split('\n')
  damageLines.forEach((line, i) => {
    drawText(line, contentStart + 3, y + 6 + i * 5, { fontSize: 9 })
  })
  y += damageHeight

  // 7. 조치 및 결과
  const actionHeight = Math.max(20, Math.ceil((report.action || '').length / 30) * 6 + 10)
  drawRect(leftCol, y, tableWidth, actionHeight)
  drawRect(leftCol, y, labelWidth, actionHeight)
  drawFilledRect(leftCol + 0.15, y + 0.15, labelWidth - 0.3, actionHeight - 0.3, '#f0f4f8')
  drawText('조치 및\n결과', leftCol + 3, y + 6, { fontSize: 10, fontWeight: 'bold' })
  ctx.font = `normal ${mm(9 * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
  ctx.fillStyle = '#000'
  wrapText(ctx, report.action || '', mm(contentStart + 3), mm(y + 6), mm(contentWidth - 6), mm(5))
  y += actionHeight

  // 8. 붙임물
  drawRow('붙임물', report.photos?.length > 0 ? `별도첨부 사진 ${report.photos.length}매` : '없음')

  // 하단 작성정보
  y += 5
  drawText(`작성일: ${new Date().toLocaleDateString('ko-KR')}`, leftCol, y + 5, { fontSize: 9, color: '#666' })
  drawText('사업명: ' + (report.projectName || ''), leftCol, y + 10, { fontSize: 9, color: '#666' })

  // Canvas를 이미지로 변환 후 PDF에 추가
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)

  // 사진이 있으면 별도 페이지에 추가
  if (report.photos && report.photos.length > 0) {
    for (let i = 0; i < report.photos.length; i++) {
      try {
        const photo = report.photos[i]
        if (!photo || !photo.data) continue

        doc.addPage()

        // 헤더: "첨부사진 1/3"
        const hCanvas = document.createElement('canvas')
        hCanvas.width = pageWidth * scale
        hCanvas.height = 30 * scale
        const hCtx = hCanvas.getContext('2d')
        hCtx.fillStyle = '#ffffff'
        hCtx.fillRect(0, 0, hCanvas.width, hCanvas.height)
        hCtx.font = `bold ${mm(12 * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
        hCtx.fillStyle = '#1a365d'
        hCtx.fillText(`첨부사진 ${i + 1}/${report.photos.length}`, mm(15), mm(20))
        doc.addImage(hCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, 30)

        // 사진 삽입 (이미 리사이즈된 JPEG 데이터)
        const w = photo.width || 800
        const h = photo.height || 600
        const maxW = 180
        const maxH = 230
        const ratio = Math.min(maxW / w, maxH / h)
        const pdfW = w * ratio
        const pdfH = h * ratio
        const xOffset = (pageWidth - pdfW) / 2

        doc.addImage(photo.data, 'JPEG', xOffset, 35, pdfW, pdfH)
      } catch (e) {
        console.error('사진 추가 실패:', i, e)
      }
    }
  }

  return doc.output('blob')
}

// ===== 차량 사고 보고서 PDF =====
async function generateVehiclePDF(report) {
  const doc = new jsPDF('p', 'mm', 'a4')

  const canvas = document.createElement('canvas')
  const scale = 3
  const pageWidth = 210
  const pageHeight = 297
  canvas.width = pageWidth * scale
  canvas.height = pageHeight * scale
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const mm = (val) => val * scale
  let y = 20

  const drawText = (text, x, yPos, options = {}) => {
    const { fontSize = 10, fontWeight = 'normal', color = '#000', align = 'left' } = options
    ctx.font = `${fontWeight} ${mm(fontSize * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(text, mm(x), mm(yPos))
    ctx.textAlign = 'left'
  }

  const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
    const chars = text.split('')
    let line = ''
    let currentY = y
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i]
      if (context.measureText(testLine).width > maxWidth && i > 0) {
        context.fillText(line, x, currentY)
        line = chars[i]
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    context.fillText(line, x, currentY)
    return currentY
  }

  const drawRect = (x, yPos, w, h) => {
    ctx.strokeStyle = '#000'
    ctx.lineWidth = mm(0.3)
    ctx.strokeRect(mm(x), mm(yPos), mm(w), mm(h))
  }

  const drawFilledRect = (x, yPos, w, h, color) => {
    ctx.fillStyle = color
    ctx.fillRect(mm(x), mm(yPos), mm(w), mm(h))
  }

  // 제목
  drawText('차 량 사 고 보 고 서', 105, y, { fontSize: 18, fontWeight: 'bold', align: 'center' })
  ctx.beginPath()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = mm(0.5)
  ctx.moveTo(mm(55), mm(y + 2))
  ctx.lineTo(mm(155), mm(y + 2))
  ctx.stroke()

  y += 15

  const leftCol = 20
  const labelWidth = 30
  const tableWidth = 170
  const contentStart = leftCol + labelWidth

  // 행 그리기
  const drawRow = (label, content, height = 12) => {
    drawRect(leftCol, y, tableWidth, height)
    drawRect(leftCol, y, labelWidth, height)
    drawFilledRect(leftCol + 0.15, y + 0.15, labelWidth - 0.3, height - 0.3, '#f0f4f8')
    drawText(label, leftCol + 3, y + height / 2 + 1.5, { fontSize: 10, fontWeight: 'bold' })

    // 내용 텍스트 래핑
    ctx.font = `normal ${mm(10 * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
    ctx.fillStyle = '#000'
    wrapText(ctx, content || '', mm(contentStart + 3), mm(y + 6), mm(tableWidth - labelWidth - 6), mm(5))

    y += height
  }

  // 소속 / 차량번호 / 운전원 (3열)
  const col1W = 30
  const col2W = 55
  const col3LabelW = 25
  const col3W = tableWidth - col1W - col2W - col3LabelW
  const headerH = 12

  // 소속
  drawRect(leftCol, y, col1W, headerH)
  drawFilledRect(leftCol + 0.15, y + 0.15, col1W - 0.3, headerH - 0.3, '#f0f4f8')
  drawText('소  속', leftCol + 3, y + 7.5, { fontSize: 10, fontWeight: 'bold' })

  drawRect(leftCol + col1W, y, col2W, headerH)
  drawText(report.displayCompany || report.company || '', leftCol + col1W + 3, y + 7.5, { fontSize: 10 })

  // 차량번호
  drawRect(leftCol + col1W + col2W, y, col3LabelW, headerH)
  drawFilledRect(leftCol + col1W + col2W + 0.15, y + 0.15, col3LabelW - 0.3, headerH - 0.3, '#f0f4f8')
  drawText('차량번호', leftCol + col1W + col2W + 3, y + 7.5, { fontSize: 10, fontWeight: 'bold' })

  drawRect(leftCol + col1W + col2W + col3LabelW, y, col3W, headerH)
  drawText(report.vehicleNumber || '', leftCol + col1W + col2W + col3LabelW + 3, y + 7.5, { fontSize: 10 })

  y += headerH

  // 운전원 행 추가
  drawRect(leftCol, y, col1W, headerH)
  drawFilledRect(leftCol + 0.15, y + 0.15, col1W - 0.3, headerH - 0.3, '#f0f4f8')
  drawText('운전원', leftCol + 3, y + 7.5, { fontSize: 10, fontWeight: 'bold' })

  drawRect(leftCol + col1W, y, tableWidth - col1W, headerH)
  const driverInfo = `${report.rank || ''} ${report.name || ''} (${report.phone || ''})`.trim()
  drawText(driverInfo, leftCol + col1W + 3, y + 7.5, { fontSize: 10 })

  y += headerH

  // 사고 발생일자
  let dateDisplay = ''
  if (report.date) {
    const d = new Date(report.date)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    dateDisplay = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${report.time || ''} (${dayNames[d.getDay()]}요일)`
  }
  drawRow('사    고\n발생일자', dateDisplay, 16)

  // 발생장소
  drawRow('발생장소', report.location || '', 20)

  // 발생상황 (발생경위 자동생성 + 직접기입)
  const autoDesc = buildAutoDescription(report)
  const fullDesc = autoDesc + (report.description ? ' ' + report.description : '')
  drawRow('발생상황', fullDesc, 35)

  // 사고원인 (발생경위 직접기입 부분)
  drawRow('사고원인', report.description || '', 30)

  // 주요 피해내용
  let damageText = ''
  if (report.damageHuman) damageText += `[인명피해] ${report.damageHumanDetail || ''}`
  if (report.damageProperty) damageText += `${damageText ? '\n' : ''}[물적피해] ${report.damagePropertyDetail || ''}`
  drawRow('주    요\n피해내용', damageText || '해당없음', 30)

  // 기타 조치 및 요구사항
  drawRow('기타 조치 및\n요구사항', report.action || '', 30)

  // 보고일시 / 보고자
  y += 5
  if (report.date) {
    const d = new Date(report.date)
    drawText(`보고일시 :          ${d.getFullYear()}년          ${d.getMonth() + 1}월          ${d.getDate()}일`, 105, y + 5, { fontSize: 10, align: 'center' })
  }
  drawText('보고자 : 매립운영처장                       (인)', 105, y + 12, { fontSize: 10, align: 'center' })

  // Canvas → PDF
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)

  // 사진 페이지 추가
  if (report.photos && report.photos.length > 0) {
    for (let i = 0; i < report.photos.length; i++) {
      try {
        const photo = report.photos[i]
        if (!photo || !photo.data) continue

        doc.addPage()

        const hCanvas = document.createElement('canvas')
        hCanvas.width = pageWidth * scale
        hCanvas.height = 30 * scale
        const hCtx = hCanvas.getContext('2d')
        hCtx.fillStyle = '#ffffff'
        hCtx.fillRect(0, 0, hCanvas.width, hCanvas.height)
        hCtx.font = `bold ${mm(12 * 0.35)}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
        hCtx.fillStyle = '#1a365d'
        hCtx.fillText(`첨부사진 ${i + 1}/${report.photos.length}`, mm(15), mm(20))
        doc.addImage(hCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, 30)

        const w = photo.width || 800
        const h = photo.height || 600
        const maxW = 180
        const maxH = 230
        const ratio = Math.min(maxW / w, maxH / h)
        const pdfW = w * ratio
        const pdfH = h * ratio
        const xOffset = (pageWidth - pdfW) / 2

        doc.addImage(photo.data, 'JPEG', xOffset, 35, pdfW, pdfH)
      } catch (e) {
        console.error('사진 추가 실패:', i, e)
      }
    }
  }

  return doc.output('blob')
}

function buildAutoDescription(report) {
  const project = report.projectName || ''
  // displayCompany가 있으면 사용 (하도급 없으면 본업체명만)
  const company = report.displayCompany || report.company || ''
  const rank = report.rank || ''
  const name = report.name || ''
  const loc = report.location || ''
  const dateStr = report.date || ''
  const timeStr = report.time ? ` ${report.time}` : ''

  return `'${project}' 진행 중 '${company}' 소속 '${rank} ${name}'님이 '${loc}'에서 '${dateStr}${timeStr}'에`
}
