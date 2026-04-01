/**
 * 사고발생보고서 이메일 발송 백엔드 서버
 *
 * 사용법:
 * 1. npm install express cors nodemailer multer
 * 2. node server/server.js
 * 3. 앱 관리자 페이지에서 Gmail 설정 입력
 */

const express = require('express')
const cors = require('cors')
const nodemailer = require('nodemailer')
const multer = require('multer')
const path = require('path')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// 프론트엔드 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')))

// 동적 transporter 생성 (앱에서 전달받은 Gmail 설정 사용)
function createTransporter(smtpConfig) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpConfig.email,
      pass: smtpConfig.appPassword
    }
  })
}

// 보고서 제출 + 이메일 발송 API
app.post('/api/submit-report', upload.single('pdf'), async (req, res) => {
  try {
    const { recipients, reportSummary, smtp } = JSON.parse(req.body.data)
    const pdfBuffer = req.file?.buffer

    // Gmail 설정 확인
    if (!smtp?.email || !smtp?.appPassword) {
      return res.status(400).json({
        success: false,
        message: '관리자 페이지에서 Gmail 발송 설정을 먼저 완료하세요.'
      })
    }

    if (!recipients || recipients.length === 0) {
      return res.json({ success: true, message: '수신자가 없어 이메일 발송을 건너뜁니다.' })
    }

    const emailList = recipients.map(r => r.email).filter(Boolean)
    if (emailList.length === 0) {
      return res.json({ success: true, message: '유효한 이메일 주소가 없습니다.' })
    }

    const transporter = createTransporter(smtp)

    const mailOptions = {
      from: `"매립운영처 사고보고시스템" <${smtp.email}>`,
      to: emailList.join(', '),
      subject: `[사고발생보고] ${reportSummary.projectName} - ${reportSummary.name} (${reportSummary.date})`,
      html: `
        <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">사고 발생보고서</h2>
          </div>
          <div style="padding: 20px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; background: #f0f4f8; font-weight: bold; width: 100px;">사업명</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reportSummary.projectName}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; background: #f0f4f8; font-weight: bold;">소속</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reportSummary.company}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; background: #f0f4f8; font-weight: bold;">성명</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reportSummary.rank} ${reportSummary.name}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; background: #f0f4f8; font-weight: bold;">발생장소</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reportSummary.location}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; background: #f0f4f8; font-weight: bold;">일시</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reportSummary.date} ${reportSummary.time || ''}</td></tr>
            </table>
            <p style="margin-top: 16px; color: #718096; font-size: 14px;">
              상세 내용은 첨부된 PDF 파일을 확인하세요.
            </p>
          </div>
          <div style="padding: 12px; text-align: center; color: #a0aec0; font-size: 12px;">
            수도권매립지관리공사 매립운영처 사고보고시스템
          </div>
        </div>
      `,
      attachments: pdfBuffer ? [{
        filename: `사고발생보고서_${reportSummary.name}_${reportSummary.date}.pdf`,
        content: pdfBuffer
      }] : []
    }

    await transporter.sendMail(mailOptions)

    res.json({
      success: true,
      message: `${emailList.length}명에게 보고서가 발송되었습니다.`,
      sentTo: emailList
    })
  } catch (error) {
    console.error('이메일 발송 실패:', error)
    res.status(500).json({
      success: false,
      message: '이메일 발송에 실패했습니다: ' + error.message
    })
  }
})

// 이메일 설정 테스트 API
app.post('/api/test-email', async (req, res) => {
  try {
    const { smtp, testTo } = req.body
    if (!smtp?.email || !smtp?.appPassword) {
      return res.status(400).json({ success: false, message: 'Gmail 설정이 없습니다.' })
    }

    const transporter = createTransporter(smtp)
    await transporter.sendMail({
      from: `"매립운영처 사고보고시스템" <${smtp.email}>`,
      to: testTo || smtp.email,
      subject: '[테스트] 사고보고시스템 이메일 발송 테스트',
      text: '이 메일이 수신되었다면 이메일 설정이 정상적으로 완료된 것입니다.'
    })

    res.json({ success: true, message: '테스트 이메일이 발송되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, message: '발송 실패: ' + error.message })
  }
})

// 서버 상태 확인
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 프론트엔드 라우팅 (SPA - 모든 경로를 index.html로)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`사고보고서 서버가 포트 ${PORT}에서 실행 중입니다.`)
})
