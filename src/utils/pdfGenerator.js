import jsPDF from 'jspdf'

// 한글 폰트를 위해 내장 폰트 대신 유니코드 지원 방식 사용
export async function generatePDF(report) {
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
        const photoData = report.photos[i].data
        if (!photoData) continue

        // 이미지 로드
        const img = new Image()
        img.src = photoData
        const loaded = await new Promise((resolve) => {
          img.onload = () => resolve(true)
          img.onerror = () => resolve(false)
        })

        if (!loaded || img.width === 0) continue

        doc.addPage()

        // 헤더 텍스트를 캔버스로 그리기
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

        // 사진을 캔버스에 그려서 리사이즈 후 JPEG로 변환
        const pCanvas = document.createElement('canvas')
        const maxPx = 1200
        let w = img.width
        let h = img.height
        if (w > maxPx || h > maxPx) {
          const r = Math.min(maxPx / w, maxPx / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }
        pCanvas.width = w
        pCanvas.height = h
        const pCtx = pCanvas.getContext('2d')
        pCtx.drawImage(img, 0, 0, w, h)
        const resizedData = pCanvas.toDataURL('image/jpeg', 0.8)

        // PDF에 사진 배치
        const maxW = 180
        const maxH = 230
        const ratio = Math.min(maxW / w, maxH / h)
        const pdfW = w * ratio
        const pdfH = h * ratio
        const xOffset = (pageWidth - pdfW) / 2

        doc.addImage(resizedData, 'JPEG', xOffset, 35, pdfW, pdfH)
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
