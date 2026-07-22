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
const webpush = require('web-push')

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

// 관리자 인증 미들웨어 - 슈퍼관리자 토큰 또는 부서 관리자 토큰 검증
async function requireAdminAuth(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN
  const clientToken = req.headers['x-admin-token']

  // 환경변수 미설정 시 경고 후 통과 (호환성)
  if (!adminToken) {
    console.warn('⚠️  ADMIN_TOKEN 환경변수 미설정 - 관리자 API가 무방비 상태입니다')
    req.adminRole = 'super'
    return next()
  }

  // 슈퍼관리자 토큰 확인
  if (clientToken === adminToken) {
    req.adminRole = 'super'
    return next()
  }

  // 부서 관리자 토큰 확인 (DB에서 조회)
  if (clientToken && db) {
    try {
      const deptAdmin = await db.collection('dept_admins').findOne({ token: clientToken, status: 'active' })
      if (deptAdmin) {
        req.adminRole = 'dept'
        req.adminDeptId = deptAdmin.deptId
        return next()
      }
    } catch {}
  }

  res.status(401).json({ success: false, message: '관리자 인증이 필요합니다.' })
}

// 슈퍼관리자 전용 미들웨어
function requireSuperAdmin(req, res, next) {
  if (req.adminRole === 'super') return next()
  res.status(403).json({ success: false, message: '슈퍼관리자 권한이 필요합니다.' })
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

// GitHub API로 public/kakao-config.json 업데이트 (프론트엔드 정적 파일 → 백엔드 없이 항상 접근 가능)
async function updateGithubKakaoConfig(deptId, kakaoLink) {
  const token = process.env.GITHUB_TOKEN
  if (!token) return // 토큰 미설정 시 스킵 (기존 방식으로 fallback)

  const owner = 'junjunlee12'
  const repo = 'accident-report-app'
  const filePath = 'public/kakao-config.json'

  try {
    // 현재 파일 내용 + SHA 가져오기
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    })

    let currentData = {}
    let sha = null
    if (getRes.ok) {
      const fileData = await getRes.json()
      sha = fileData.sha
      currentData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'))
    }

    // kakaoLink 업데이트 (없으면 해당 부서 항목 제거)
    if (kakaoLink) {
      currentData[deptId] = { kakaoLink }
    } else {
      delete currentData[deptId]
    }

    const content = Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64')
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore: update kakao config for ${deptId}`,
        content,
        ...(sha && { sha })
      })
    })

    if (!putRes.ok) {
      const err = await putRes.json()
      console.error('GitHub kakao-config 업데이트 실패:', err.message)
    } else {
      console.log(`GitHub kakao-config 업데이트 완료: ${deptId} → ${kakaoLink || '(제거)'}`)
    }
  } catch (e) {
    console.error('GitHub kakao-config 업데이트 오류:', e.message)
  }
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
    // 부서 관리자는 자신의 부서만 수정 가능
    if (req.adminRole === 'dept' && deptId !== req.adminDeptId) {
      return res.status(403).json({ success: false, message: '자신의 부서 설정만 수정할 수 있습니다.' })
    }
    const key = deptId ? `dept_${deptId}` : 'admin_settings'
    await saveSettingsToDB(key, req.body)

    // kakaoLink가 포함된 경우 GitHub 정적 파일도 업데이트 (프론트엔드 즉시 반영용)
    if (deptId && req.body.kakaoLink !== undefined) {
      updateGithubKakaoConfig(deptId, req.body.kakaoLink).catch(() => {})
    }

    res.json({ success: true, message: '설정이 저장되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, message: '설정 저장 실패: ' + error.message })
  }
})

// 설정 조회 (관리자 전용 - 수신자 이메일 등 민감 정보 포함)
app.get('/api/settings', requireAdminAuth, async (req, res) => {
  const deptId = req.query.dept
  // 부서 관리자는 자신의 부서만 조회 가능
  if (req.adminRole === 'dept' && deptId !== req.adminDeptId) {
    return res.status(403).json({ success: false, message: '자신의 부서 설정만 조회할 수 있습니다.' })
  }
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
        filename: `report-${reportSummary.date}.pdf`,
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

// ===== 부서 목록 설정 API =====

// 부서 목록 조회 (공개 - 첫 화면 렌더링용)
app.get('/api/dept-config', async (req, res) => {
  if (!db) return res.json({ success: false, departments: null })
  try {
    const doc = await db.collection('settings').findOne({ _id: 'dept_config' })
    if (doc?.departments) {
      res.json({ success: true, departments: doc.departments })
    } else {
      res.json({ success: false, departments: null })
    }
  } catch (e) {
    res.json({ success: false, departments: null })
  }
})

// 부서 목록 저장 (슈퍼관리자 전용)
app.post('/api/dept-config', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { departments } = req.body
  if (!Array.isArray(departments) || departments.length === 0) {
    return res.status(400).json({ success: false, message: '부서 목록이 비어있습니다.' })
  }
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  try {
    await db.collection('settings').updateOne(
      { _id: 'dept_config' },
      { $set: { departments, updatedAt: new Date() } },
      { upsert: true }
    )
    res.json({ success: true, message: '부서 설정이 저장되었습니다.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ===== 부서 관리자 API =====
const crypto = require('crypto')
const { ObjectId } = require('mongodb')

// 부서 관리자 신청 (누구나 접근 가능)
app.post('/api/dept-admin/apply', async (req, res) => {
  const { deptId, adminId, adminPw } = req.body
  if (!deptId || !adminId || !adminPw) {
    return res.status(400).json({ success: false, message: '부서, 아이디, 비밀번호를 모두 입력하세요.' })
  }
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  try {
    // 이미 활성화된 관리자 존재 확인
    const active = await db.collection('dept_admins').findOne({ deptId, status: 'active' })
    if (active) {
      return res.status(400).json({ success: false, message: '해당 부서에 이미 활성화된 관리자가 있습니다.' })
    }
    // 동일 아이디로 대기 중인 신청 확인
    const pending = await db.collection('dept_admins').findOne({ deptId, adminId, status: 'pending' })
    if (pending) {
      return res.status(400).json({ success: false, message: '이미 승인 대기 중인 신청이 있습니다.' })
    }
    await db.collection('dept_admins').insertOne({
      deptId, adminId, adminPw,
      status: 'pending',
      token: null,
      createdAt: new Date()
    })
    res.json({ success: true, message: '신청 완료! 슈퍼관리자 승인 후 로그인 가능합니다.' })
  } catch (e) {
    res.status(500).json({ success: false, message: '신청 실패: ' + e.message })
  }
})

// 부서 관리자 로그인
app.post('/api/dept-admin/login', async (req, res) => {
  const { deptId, adminId, adminPw } = req.body
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  try {
    const admin = await db.collection('dept_admins').findOne({ deptId, adminId, adminPw, status: 'active' })
    if (!admin) {
      // 대기 중인지 확인해서 더 친절한 메시지
      const pending = await db.collection('dept_admins').findOne({ deptId, adminId })
      if (pending?.status === 'pending') {
        return res.status(401).json({ success: false, message: '아직 슈퍼관리자 승인 대기 중입니다.' })
      }
      if (pending?.status === 'rejected') {
        return res.status(401).json({ success: false, message: '승인이 거절된 계정입니다. 슈퍼관리자에게 문의하세요.' })
      }
      return res.status(401).json({ success: false, message: '부서, 아이디 또는 비밀번호가 일치하지 않습니다.' })
    }
    const token = crypto.randomBytes(32).toString('hex')
    await db.collection('dept_admins').updateOne({ _id: admin._id }, { $set: { token, lastLogin: new Date() } })
    res.json({ success: true, token, deptId, role: 'dept' })
  } catch (e) {
    res.status(500).json({ success: false, message: '로그인 실패: ' + e.message })
  }
})

// 부서 관리자 목록 조회 (슈퍼관리자 전용)
app.get('/api/dept-admin/list', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  if (!db) return res.json({ success: true, admins: [] })
  try {
    const admins = await db.collection('dept_admins').find({}).sort({ createdAt: -1 }).toArray()
    // 비밀번호·토큰 제거 후 반환
    const safe = admins.map(({ adminPw, token, ...rest }) => ({ ...rest, _id: rest._id.toString() }))
    res.json({ success: true, admins: safe })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 승인 (슈퍼관리자 전용)
app.post('/api/dept-admin/approve', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.body
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  try {
    const token = crypto.randomBytes(32).toString('hex')
    await db.collection('dept_admins').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'active', token, approvedAt: new Date() } }
    )
    res.json({ success: true, message: '승인되었습니다.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 거절 (슈퍼관리자 전용)
app.post('/api/dept-admin/reject', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.body
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  try {
    await db.collection('dept_admins').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'rejected', rejectedAt: new Date(), token: null } }
    )
    res.json({ success: true, message: '거절되었습니다.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 삭제 (슈퍼관리자 전용)
app.post('/api/dept-admin/delete', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.body
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  try {
    await db.collection('dept_admins').deleteOne({ _id: new ObjectId(id) })
    res.json({ success: true, message: '삭제되었습니다.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ===== Web Push 엔드포인트 =====

// VAPID 설정 (환경변수에서 읽기)
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:junzzanghi@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    console.log('Web Push VAPID 설정 완료')
  } else {
    console.warn('⚠️  VAPID 키 미설정 — 긴급 알림 기능 비활성화')
  }
} catch (e) {
  console.error('VAPID 설정 오류:', e.message)
}

// VAPID 공개키 반환 (클라이언트가 구독 시 필요)
app.get('/api/push/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return res.status(500).json({ success: false, message: 'VAPID_PUBLIC_KEY 환경변수 미설정' })
  res.json({ success: true, publicKey: key })
})

// 긴급 버튼 — 인증 없이 누구나 발송 (부서 직원용, 고정 메시지)
const emergencyLastSent = {}  // 부서별 마지막 발송 시각 (도배 방지)
app.post('/api/push/emergency', async (req, res) => {
  const { deptId } = req.body
  if (!deptId) return res.status(400).json({ success: false, message: '부서 정보 없음' })
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(500).json({ success: false, message: 'VAPID 키 미설정' })

  // 같은 부서에서 60초 내 중복 발송 방지
  const now = Date.now()
  if (emergencyLastSent[deptId] && now - emergencyLastSent[deptId] < 60000) {
    const remaining = Math.ceil((60000 - (now - emergencyLastSent[deptId])) / 1000)
    return res.status(429).json({ success: false, message: `${remaining}초 후 다시 발송 가능합니다.` })
  }

  try {
    const subs = await db.collection('push_subscriptions').find({ deptId }).toArray()
    if (subs.length === 0) return res.json({ success: true, sent: 0 })

    const { location } = req.body
    const mapsUrl = location
      ? `https://maps.google.com/?q=${location.lat},${location.lng}`
      : null

    const payload = JSON.stringify({
      title: `🚨 ${deptId} 긴급 상황 발생`,
      body: mapsUrl
        ? `즉시 확인하세요!\n📍 발신자 위치 → ${mapsUrl}`
        : '즉시 확인하세요!',
      deptId,
      mapsUrl,
    })

    const results = await Promise.allSettled(
      subs.map(s => webpush.sendNotification(s.subscription, payload))
    )

    const expiredEndpoints = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const code = r.reason?.statusCode
        if (code === 410 || code === 404) expiredEndpoints.push(subs[i].endpoint)
      }
    })
    if (expiredEndpoints.length > 0) {
      await db.collection('push_subscriptions').deleteMany({ endpoint: { $in: expiredEndpoints } })
    }

    emergencyLastSent[deptId] = now
    const sent = results.filter(r => r.status === 'fulfilled').length
    res.json({ success: true, sent })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 구독 저장 (누구나 가능)
app.post('/api/push/subscribe', async (req, res) => {
  const { subscription, deptId, deviceId } = req.body
  if (!db || !subscription || !deptId) return res.status(400).json({ success: false })
  try {
    // 같은 기기의 이전 구독(다른 endpoint) 모두 삭제 → 중복 발송 방지
    if (deviceId) {
      await db.collection('push_subscriptions').deleteMany({
        deviceId,
        endpoint: { $ne: subscription.endpoint }
      })
    }
    await db.collection('push_subscriptions').updateOne(
      { endpoint: subscription.endpoint },
      { $set: { subscription, deptId, deviceId: deviceId || null, updatedAt: new Date() } },
      { upsert: true }
    )
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 구독 취소 (누구나 가능)
app.post('/api/push/unsubscribe', async (req, res) => {
  const { endpoint, deviceId } = req.body
  if (!db || !endpoint) return res.status(400).json({ success: false })
  try {
    // endpoint + deviceId 기준으로 모두 삭제
    const query = deviceId
      ? { $or: [{ endpoint }, { deviceId }] }
      : { endpoint }
    await db.collection('push_subscriptions').deleteMany(query)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 이 기기의 구독 부서 조회 — localStorage migration 용
app.get('/api/push/my-subscription', async (req, res) => {
  const { deviceId } = req.query
  if (!deviceId || !db) return res.json({ deptId: null })
  try {
    const sub = await db.collection('push_subscriptions').findOne({ deviceId }, { projection: { deptId: 1 } })
    res.json({ deptId: sub?.deptId || null })
  } catch {
    res.json({ deptId: null })
  }
})

// 부서별 구독자 수 (관리자 전용)
app.get('/api/push/subscriber-count', requireAdminAuth, async (req, res) => {
  const { dept } = req.query
  if (!db) return res.status(500).json({ success: false })
  try {
    const query = dept ? { deptId: dept } : {}
    const count = await db.collection('push_subscriptions').countDocuments(query)
    res.json({ success: true, count })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 긴급 푸시 발송 (관리자 전용)
app.post('/api/push/send', requireAdminAuth, async (req, res) => {
  const { deptId, title, body } = req.body
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(500).json({ success: false, message: 'VAPID 키 미설정 — Render 환경변수를 확인하세요.' })

  // 부서 관리자는 자기 부서에만 발송 가능
  if (req.adminRole === 'dept' && deptId !== req.adminDeptId) {
    return res.status(403).json({ success: false, message: '자신의 부서에만 발송할 수 있습니다.' })
  }

  try {
    const query = deptId ? { deptId } : {}
    const subs = await db.collection('push_subscriptions').find(query).toArray()
    if (subs.length === 0) return res.json({ success: true, sent: 0, total: 0 })

    const payload = JSON.stringify({
      title: title || '🚨 긴급 알림',
      body: body || '사고가 발생했습니다. 즉시 확인하세요.',
      deptId,
    })

    const results = await Promise.allSettled(
      subs.map(s => webpush.sendNotification(s.subscription, payload))
    )

    // 만료된 구독 정리 (410 Gone / 404 Not Found)
    const expiredEndpoints = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const code = r.reason?.statusCode
        if (code === 410 || code === 404) expiredEndpoints.push(subs[i].endpoint)
      }
    })
    if (expiredEndpoints.length > 0) {
      await db.collection('push_subscriptions').deleteMany({ endpoint: { $in: expiredEndpoints } })
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    res.json({ success: true, sent, total: subs.length })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// 테스트 알림 발송 (슈퍼관리자 전용 — 자기 기기에만)
app.post('/api/push/test', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { deviceId } = req.body
  if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId 없음' })
  if (!db) return res.status(500).json({ success: false, message: 'DB 연결 없음' })
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(500).json({ success: false, message: 'VAPID 키 미설정' })

  try {
    const sub = await db.collection('push_subscriptions').findOne({ deviceId })
    if (!sub) {
      return res.json({ success: false, message: '이 기기에 등록된 구독 없음 — 먼저 부서 페이지에서 "알림받기"를 켜세요.' })
    }

    const payload = JSON.stringify({
      title: '✅ 긴급 알림 테스트',
      body: '관리자 테스트 알림입니다. 푸시가 정상 수신되었습니다.',
      deptId: sub.deptId,
    })

    try {
      await webpush.sendNotification(sub.subscription, payload)
      res.json({ success: true, message: '테스트 알림 발송 완료 — 이 기기에서 수신 여부를 확인하세요.' })
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await db.collection('push_subscriptions').deleteOne({ deviceId })
        return res.json({ success: false, message: '구독이 만료되었습니다. 부서 페이지에서 다시 "알림받기"를 켜세요.' })
      }
      throw e
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: !!db, brevo: !!process.env.BREVO_API_KEY, timestamp: new Date().toISOString() })
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 3001

// 서버를 먼저 띄워서 Render 헬스체크 통과, MongoDB는 백그라운드에서 연결
app.listen(PORT, () => {
  console.log(`사고보고서 서버가 포트 ${PORT}에서 실행 중입니다.`)
  console.log(`Brevo API: ${process.env.BREVO_API_KEY ? '설정됨' : '미설정'}`)
})
connectDB()
