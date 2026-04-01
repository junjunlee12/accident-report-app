/**
 * 사고발생보고서 이메일 발송 백엔드 서버
 *
 * 환경변수 설정 (Render 대시보드에서):
 *   GMAIL_USER=발송용Gmail주소
 *   GMAIL_APP_PASSWORD=구글앱비밀번호16자리
 *   RECIPIENTS=JSON문자열 (수신자 목록)
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

// ===== 환경변수에서 설정 읽기 (영구 유지) =====
function getSmtpConfig() {
  return {
    email: process.env.GMAIL_USER || '',
    appPassword: process.env.GMAIL_APP_PASSWORD || ''
  }
}

function getRecipients() {
  try {
    if (process.env.RECIPIENTS) {
      return JSON.parse(process.env.RECIPIENTS)
    }
  } catch (e) {
    console.error('수신자 설정 파싱 오류:', e)
  }
  return {}
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

// 관리자 설정 조회
app.get('/api/settings', (req, res) => {
  const smtp = getSmtpConfig()
  const recipients = getRecipients()
  const configured = !!(smtp.email && smtp.appPassword)

  res.json({
    success: configured,
    settings: {
      smtp: {
        email: smtp.email ? smtp.email.replace(/(.{3}).*(@.*)/, '$1***$2') : '',
        configured: configured
      },
      recipients,
      notificationMethod: 'email'
    }
  })
})

// ===== 보고서 제출 + 이메일 발송 =====
app.post('/api/submit-report', upload.single('pdf'), async (req, res) => {
  try {
    const { reportSummary } = JSON.parse(req.body.data)
    const pdfBuffer = req.file?.buffer

    // 환경변수에서 설정 읽기
    const smtp = getSmtpConfig()
    if (!smtp.email || !smtp.appPassword) {
      return res.status(400).json({
        success: false,
        message: '관리자가 Gmail 발송 설정을 아직 완료하지 않았습니다. 관리자에게 문의하세요.'
      })
    }

    // 해당 사업명의 수신자 찾기
    const allRecipients = getRecipients()
    const recipients = allRecipients[reportSummary.projectName] || []
    const emailList = recipients.map(r => r.email).filter(Boolean)

    if (emailList.length === 0) {
      return res.json({
        success: false,
        message: '해당 사업의 수신자가 등록되지 않았습니다. 관리자에게 문의하세요.'
      })
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
    const smtp = getSmtpConfig()
    if (!smtp.email || !smtp.appPassword) {
      return res.status(400).json({ success: false, message: 'Gmail 환경변수가 설정되지 않았습니다.' })
    }

    const transporter = createTransporter(smtp)
    await transporter.sendMail({
      from: `"매립운영처 사고보고시스템" <${smtp.email}>`,
      to: req.body.testTo || smtp.email,
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
  const smtp = getSmtpConfig()
  console.log(`Gmail 설정: ${smtp.email ? '완료' : '미설정'}`)
  console.log(`수신자 설정: ${Object.keys(getRecipients()).length > 0 ? '완료' : '미설정'}`)
})
