/**
 * 사고발생보고서 이메일 발송 백엔드 서버
 */

const express = require('express')
const cors = require('cors')
const nodemailer = require('nodemailer')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// 프론트엔드 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')))

// 설정 파일 경로
const SETTINGS_FILE = path.join(__dirname, 'settings.json')

// 설정 읽기
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('설정 읽기 실패:', e)
  }
  return null
}

// 설정 저장
function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8')
}

// 동적 transporter 생성
function createTransporter(smtpConfig) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpConfig.email,
      pass: smtpConfig.appPassword
    }
  })
}

// ===== 설정 API =====

// 관리자 설정 저장
app.post('/api/settings', (req, res) => {
  try {
    saveSettings(req.body)
    res.json({ success: true, message: '설정이 저장되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, message: '설정 저장 실패: ' + error.message })
  }
})

// 관리자 설정 조회
app.get('/api/settings', (req, res) => {
  const settings = loadSettings()
  if (settings) {
    res.json({ success: true, settings })
  } else {
    res.json({ success: false, settings: null })
  }
})

// ===== 보고서 제출 + 이메일 발송 =====
app.post('/api/submit-report', upload.single('pdf'), async (req, res) => {
  try {
    const { reportSummary } = JSON.parse(req.body.data)
    const pdfBuffer = req.file?.buffer

    // 서버에 저장된 설정 읽기
    const settings = loadSettings()
    if (!settings?.smtp?.email || !settings?.smtp?.appPassword) {
      return res.status(400).json({
        success: false,
        message: '관리자가 Gmail 발송 설정을 아직 완료하지 않았습니다.'
      })
    }

    // 해당 사업명의 수신자 찾기
    const recipients = settings.recipients?.[reportSummary.projectName] || []
    const emailList = recipients.map(r => r.email).filter(Boolean)

    if (emailList.length === 0) {
      return res.json({
        success: true,
        message: '해당 사업의 수신자가 등록되지 않았습니다. 관리자에게 문의하세요.'
      })
    }

    const transporter = createTransporter(settings.smtp)

    const mailOptions = {
      from: `"매립운영처 사고보고시스템" <${settings.smtp.email}>`,
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
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; background: #f0f4f8; font-weight: bold;">연락처</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reportSummary.phone || '-'}</td></tr>
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
    const settings = loadSettings()
    if (!settings?.smtp?.email || !settings?.smtp?.appPassword) {
      return res.status(400).json({ success: false, message: 'Gmail 설정이 없습니다. 먼저 설정을 저장하세요.' })
    }

    const transporter = createTransporter(settings.smtp)
    await transporter.sendMail({
      from: `"매립운영처 사고보고시스템" <${settings.smtp.email}>`,
      to: req.body.testTo || settings.smtp.email,
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

// 프론트엔드 라우팅 (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`사고보고서 서버가 포트 ${PORT}에서 실행 중입니다.`)
})
