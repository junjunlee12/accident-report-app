/**
 * 사고발생보고서 이메일 발송 백엔드 서버
 *
 * 환경변수:
 *   MONGODB_URI=mongodb+srv://... (MongoDB Atlas 연결 문자열)
 *   BREVO_API_KEY=xkeysib-... (Brevo API 키)
 */

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const { MongoClient } = require('mongodb')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// ===== MongoDB 연결 =====
let db = null

async function connectDB() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI 환경변수가 설정되지 않았습니다.')
    return
  }
  try {
    const client = new MongoClient(uri)
    await client.connect()
    db = client.db('accident-report')
    console.log('MongoDB 연결 성공')
  } catch (e) {
    console.error('MongoDB 연결 실패:', e.message)
  }
}

async function loadSettings() {
  if (!db) return null
  try {
    return await db.collection('settings').findOne({ _id: 'admin_settings' })
  } catch (e) {
    console.error('설정 읽기 실패:', e)
    return null
  }
}

async function saveSettingsToDB(settings) {
  if (!db) throw new Error('데이터베이스가 연결되지 않았습니다.')
  await db.collection('settings').updateOne(
    { _id: 'admin_settings' },
    { $set: { ...settings, _id: 'admin_settings', updatedAt: new Date() } },
    { upsert: true }
  )
}

// ===== Brevo API로 이메일 발송 =====
async function sendEmail({ senderEmail, senderName, to, subject, html, attachments }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY 환경변수가 설정되지 않았습니다.')

  const body = {
    sender: { name: senderName || '매립운영처 사고보고시스템', email: senderEmail },
    to: to.map(email => ({ email })),
    subject,
    htmlContent: html,
  }

  if (attachments && attachments.length > 0) {
    body.attachment = attachments.map(att => ({
      name: att.filename,
      content: att.content.toString('base64')
    }))
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.message || `Brevo API 오류: ${response.status}`)
  }

  return await response.json()
}

// ===== 설정 API =====

app.post('/api/settings', async (req, res) => {
  try {
    await saveSettingsToDB(req.body)
    res.json({ success: true, message: '설정이 저장되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, message: '설정 저장 실패: ' + error.message })
  }
})

app.get('/api/settings', async (req, res) => {
  const settings = await loadSettings()
  const hasBrevoKey = !!process.env.BREVO_API_KEY

  if (settings && hasBrevoKey) {
    res.json({ success: true, settings })
  } else {
    res.json({
      success: false,
      settings: settings || null,
      message: !hasBrevoKey ? 'BREVO_API_KEY가 설정되지 않았습니다.' : '설정을 저장하세요.'
    })
  }
})

// ===== 보고서 제출 + 이메일 발송 =====
app.post('/api/submit-report', upload.single('pdf'), async (req, res) => {
  try {
    const { reportSummary } = JSON.parse(req.body.data)
    const pdfBuffer = req.file?.buffer

    const settings = await loadSettings()
    if (!settings?.senderEmail) {
      return res.status(400).json({
        success: false,
        message: '관리자가 발송자 이메일을 설정하지 않았습니다. 관리자에게 문의하세요.'
      })
    }

    const recipients = settings.recipients?.[reportSummary.projectName] || []
    const emailList = recipients.map(r => r.email).filter(Boolean)

    if (emailList.length === 0) {
      return res.json({
        success: false,
        message: '해당 사업의 수신자가 등록되지 않았습니다. 관리자에게 문의하세요.'
      })
    }

    await sendEmail({
      senderEmail: settings.senderEmail,
      senderName: '매립운영처 사고보고시스템',
      to: emailList,
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
    })

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

// 이메일 테스트
app.post('/api/test-email', async (req, res) => {
  try {
    const settings = await loadSettings()
    const testTo = req.body.testTo || settings?.senderEmail
    if (!testTo) {
      return res.status(400).json({ success: false, message: '테스트 수신 이메일을 입력하세요.' })
    }
    if (!settings?.senderEmail) {
      return res.status(400).json({ success: false, message: '발송자 이메일을 설정하세요.' })
    }

    await sendEmail({
      senderEmail: settings.senderEmail,
      to: [testTo],
      subject: '[테스트] 사고보고시스템 이메일 발송 테스트',
      html: '<p>이 메일이 수신되었다면 이메일 설정이 정상적으로 완료된 것입니다.</p>'
    })

    res.json({ success: true, message: '테스트 이메일이 발송되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, message: '발송 실패: ' + error.message })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: !!db, brevo: !!process.env.BREVO_API_KEY, timestamp: new Date().toISOString() })
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 3001
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`사고보고서 서버가 포트 ${PORT}에서 실행 중입니다.`)
    console.log(`Brevo API: ${process.env.BREVO_API_KEY ? '설정됨' : '미설정'}`)
  })
})
