/**
 * 사고발생보고서 이메일 발송 백엔드 서버
 *
 * 환경변수:
 *   MONGODB_URI=mongodb+srv://... (MongoDB Atlas 연결 문자열)
 *   BREVO_API_KEY=xkeysib-... (Brevo API 키)
 *   ADMIN_TOKEN=관리자_API_보호용_비밀_토큰 (랜덤 문자열)
 *   ALLOWED_ORIGINS=https://accident-report-app.onrender.com (콤마로 여러개 가능)
 */

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const { MongoClient } = require('mongodb')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

// CORS 제한 - 허용된 도메인만
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
  origin: function (origin, callback) {
    // origin이 없는 경우 (서버 간 호출, 같은 도메인 등) 허용
    if (!origin) return callback(null, true)
    // 허용 목록 비어있으면 모두 허용 (호환성)
    if (allowedOrigins.length === 0) return callback(null, true)
    // 허용 목록에 있으면 통과
    if (allowedOrigins.includes(origin)) return callback(null, true)
    // 그 외는 차단
    callback(new Error('CORS 정책 위반: 허용되지 않은 도메인'))
  }
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// 관리자 인증 미들웨어 - 토큰 검증
function requireAdminAuth(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN
  // 환경변수에 토큰 미설정 시 경고 후 통과 (호환성)
  if (!adminToken) {
    console.warn('⚠️  ADMIN_TOKEN 환경변수 미설정 - 관리자 API가 무방비 상태입니다')
    return next()
  }
  // 클라이언트가 보낸 토큰 확인
  const clientToken = req.headers['x-admin-token']
  if (clientToken === adminToken) {
    return next()
  }
  res.status(401).json({ success: false, message: '관리자 인증이 필요합니다.' })
}

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

async function loadSettings(key) {
  const docKey = key || 'admin_settings'
  if (!db) return null
  try {
    let doc = await db.collection('settings').findOne({ _id: docKey })
    // 마이그레이션: dept_매립운영처 없으면 admin_settings에서 복사
    if (!doc && docKey === 'dept_매립운영처') {
      const old = await db.collection('settings').findOne({ _id: 'admin_settings' })
      if (old) {
        const { _id, ...data } = old
        await db.collection('settings').updateOne(
          { _id: docKey },
          { $set: { ...data, _id: docKey, migratedAt: new Date() } },
          { upsert: true }
        )
        return old
      }
    }
    return doc
  } catch (e) {
    console.error('설정 읽기 실패:', e)
    return null
  }
}

async function saveSettingsToDB(key, settings) {
  const docKey = key || 'admin_settings'
  if (!db) throw new Error('DB 연결 없음')
  await db.collection('settings').updateOne(
    { _id: docKey },
    { $set: { ...settings, _id: docKey, updatedAt: new Date() } },
    { upsert: true }
  )
}

// RFC 2047 Base64 인코딩 - 이메일 첨부파일 한글 파일명 깨짐 방지
function encodeEmailFilename(filename) {
  const base64 = Buffer.from(filename, 'utf8').toString('base64')
  return `=?UTF-8?B?${base64}?=`
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

// ===== 관리자 인증 API =====

// 관리자 로그인 (ID/PW 받아서 토큰 발급)
app.post('/api/admin/login', async (req, res) => {
  const { id, password } = req.body
  const settings = await loadSettings('admin_settings')  // 명시적으로 글로벌
  const adminId = settings?.adminId || 'merib'
  const adminPw = settings?.adminPw || 'slc1000'
  const adminToken = process.env.ADMIN_TOKEN

  if (!adminToken) {
    return res.status(500).json({ success: false, message: 'ADMIN_TOKEN 환경변수가 설정되지 않았습니다.' })
  }

  if (id === adminId && password === adminPw) {
    res.json({ success: true, token: adminToken })
  } else {
    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' })
  }
})

// ===== 설정 API =====

// 설정 저장 (관리자 전용)
app.post('/api/settings', requireAdminAuth, async (req, res) => {
  try {
    const deptId = req.query.dept
    const key = deptId ? `dept_${deptId}` : 'admin_settings'
    await saveSettingsToDB(key, req.body)
    res.json({ success: true, message: '설정이 저장되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, message: '설정 저장 실패: ' + error.message })
  }
})

// 설정 조회 (관리자 전용 - 수신자 이메일 등 민감 정보 포함)
app.get('/api/settings', requireAdminAuth, async (req, res) => {
  const deptId = req.query.dept
  const key = deptId ? `dept_${deptId}` : 'admin_settings'
  const settings = await loadSettings(key)
  const hasBrevoKey = !!process.env.BREVO_API_KEY

  if (settings?.senderEmail && hasBrevoKey) {
    res.json({ success: true, settings })
  } else {
    res.json({
      success: false,
      settings: settings || null,
      message: !hasBrevoKey ? 'BREVO_API_KEY가 설정되지 않았습니다.' : !settings?.senderEmail ? '발송자 이메일을 등록하고 설정 저장하세요.' : '설정을 저장하세요.'
    })
  }
})

// 사업/소속 구성만 조회 (누구나 접근 가능, 로그인 불필요)
app.get('/api/projects', async (req, res) => {
  const deptId = req.query.dept
  const key = deptId ? `dept_${deptId}` : 'admin_settings'
  const settings = await loadSettings(key)
  res.json({
    projects: settings?.projects || null,
    kakaoLink: settings?.kakaoLink || '',
    showDrillMode: settings?.showDrillMode || false
  })
})

// ===== 보고서 제출 + 이메일 발송 =====
app.post('/api/submit-report', upload.single('pdf'), async (req, res) => {
  try {
    const { reportSummary } = JSON.parse(req.body.data)
    const pdfBuffer = req.file?.buffer
    const deptId = reportSummary.deptId
    const key = deptId ? `dept_${deptId}` : 'admin_settings'

    const settings = await loadSettings(key)
    if (!settings?.senderEmail) {
      return res.status(400).json({
        success: false,
        message: '관리자가 발송자 이메일을 설정하지 않았습니다. 관리자에게 문의하세요.'
      })
    }

    // 차량사고면 '업무용차량사고' 수신자, 아니면 사업명별 수신자
    const recipientKey = reportSummary.isVehicleAccident ? '업무용차량사고' : reportSummary.projectName
    const recipients = settings.recipients?.[recipientKey] || []
    const emailList = recipients.map(r => r.email).filter(Boolean)

    if (emailList.length === 0) {
      return res.json({
        success: false,
        message: '해당 사업의 수신자가 등록되지 않았습니다. 관리자에게 문의하세요.'
      })
    }

    const drillPrefix = reportSummary.isMockDrill ? '[모의훈련] ' : ''
    await sendEmail({
      senderEmail: settings.senderEmail,
      senderName: `${deptId || '매립운영처'} 사고보고시스템`,
      to: emailList,
      subject: `${drillPrefix}[사고발생보고] ${deptId || ''} ${reportSummary.projectName} - ${reportSummary.name} (${reportSummary.date})`,
      html: `
        <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${reportSummary.isMockDrill ? '#276749' : '#1a365d'}; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">${drillPrefix}사고 발생보고서</h2>
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
            수도권매립지관리공사 ${deptId || '매립운영처'} 사고보고시스템
          </div>
        </div>
      `,
      attachments: pdfBuffer ? [{
        filename: encodeEmailFilename(`사고보고서(${reportSummary.date}).pdf`),
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
app.post('/api/test-email', requireAdminAuth, async (req, res) => {
  try {
    const deptId = req.query.dept
    const key = deptId ? `dept_${deptId}` : 'admin_settings'
    const settings = await loadSettings(key)
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
