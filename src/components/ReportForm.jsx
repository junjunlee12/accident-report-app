import { useState, useRef, useEffect } from 'react'
import { saveReport, getAdminSettings } from '../utils/storage'
import { generatePDF } from '../utils/pdfGenerator'
import { DEFAULT_PROJECTS, getProjectNames, getCompaniesByProject } from '../config/projects'

export default function ReportForm({ formData, setFormData, initialForm }) {
  const fileInputRef = useRef(null)
  const [showModal, setShowModal] = useState(false)
  const [submittedReport, setSubmittedReport] = useState(null)
  const [projects, setProjects] = useState(DEFAULT_PROJECTS)

  // 서버에서 최신 사업/소속 설정 가져오기 (실패 시 기본값 사용)
  useEffect(() => {
    const API_URL = import.meta.env?.VITE_API_URL || ''
    fetch(`${API_URL}/api/projects`)
      .then(res => res.json())
      .then(data => {
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects)
        }
      })
      .catch(() => {
        // 서버 연결 실패 시 기본값 유지
      })
  }, [])

  const PROJECT_OPTIONS = getProjectNames(projects)

  const form = formData
  const setForm = setFormData

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const availableCompanies = form.projectName
    ? getCompaniesByProject(projects, form.projectName)
    : projects.flatMap(p => p.companies)

  // 발생경위에 표시할 소속명: 하도급 있으면 "(하도급 포함)", 없으면 본업체명만
  const getDisplayCompany = () => {
    if (!form.company) return '(소속)'
    const allCompanies = projects.flatMap(p => p.companies)
    const matched = allCompanies.find(c => c.label === form.company)
    if (!matched) return form.company
    if (form.subContractor) {
      return `${matched.label}_${form.subContractor}`
    }
    return matched.base
  }

  const getAutoDescription = () => {
    const project = form.projectName || '(사업명)'
    const displayCompany = getDisplayCompany()
    const rank = form.rank || '(직급)'
    const personName = form.name || '(성명)'
    const loc = form.location || '(발생장소)'
    const dateStr = form.date || '(일시)'
    const timeStr = form.time ? ` ${form.time}` : ''

    return { project, displayCompany, rank, personName, loc, dateStr, timeStr }
  }

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        // 이미지를 캔버스에서 리사이즈하여 용량 줄이기
        const img = new Image()
        img.onload = () => {
          const maxSize = 1000
          let w = img.width
          let h = img.height
          if (w > maxSize || h > maxSize) {
            const r = Math.min(maxSize / w, maxSize / h)
            w = Math.round(w * r)
            h = Math.round(h * r)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          const resizedData = canvas.toDataURL('image/jpeg', 0.7)
          setForm(prev => ({
            ...prev,
            photos: [...prev.photos, { name: file.name, data: resizedData, width: w, height: h }]
          }))
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removePhoto = (idx) => {
    setForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== idx)
    }))
  }

  const validate = () => {
    const missing = []
    if (form.isVehicleAccident && !form.vehicleNumber) missing.push('차량번호')
    if (!form.projectName) missing.push('사업명')
    if (!form.company) missing.push('소속')
    if (!form.location) missing.push('발생장소')
    if (!form.date) missing.push('일시')
    if (!form.name) missing.push('성명')
    if (!form.phone) missing.push('연락처')
    if (!form.damageHuman && !form.damageProperty) missing.push('피해정도')
    if (!form.action.trim()) missing.push('조치 및 결과')
    if (form.photos.length === 0) missing.push('현장 및 피해사진')
    if (!form.privacyAgreed) missing.push('개인정보 수집 동의')
    return missing
  }

  const [submitting, setSubmitting] = useState(false)
  const [sendResult, setSendResult] = useState('')

  const handleSubmit = async () => {
    const missing = validate()
    if (missing.length > 0) {
      alert('다음 필수 항목을 입력해주세요:\n' + missing.join(', '))
      return
    }

    setSubmitting(true)
    setSendResult('')

    try {
      const displayCompany = getDisplayCompany()

      // 사진 데이터 복사 (참조 유지)
      const photosCopy = [...form.photos]

      // 로컬 저장에는 사진 제외 (용량 초과 방지)
      const reportForSave = { ...form, displayCompany, photos: [] }
      reportForSave.photoCount = photosCopy.length
      const report = saveReport(reportForSave)

      // PDF에는 사진 포함
      const reportWithPhotos = { ...report, photos: photosCopy }
      setSubmittedReport(reportWithPhotos)

      const pdfBlob = await generatePDF(reportWithPhotos)
      const result = await sendNotification(reportWithPhotos, pdfBlob)

      setSendResult(result)
      setShowModal(true)
    } catch (err) {
      setSendResult('오류: ' + err.message)
      setShowModal(true)
    } finally {
      setSubmitting(false)
    }
  }

  const sendNotification = async (report, pdfBlob) => {
    try {
      const formData = new FormData()
      formData.append('pdf', pdfBlob, `사고발생보고서_${report.name}_${report.date}.pdf`)
      formData.append('data', JSON.stringify({
        reportSummary: {
          isVehicleAccident: report.isVehicleAccident,
          projectName: report.projectName,
          company: report.displayCompany,
          subContractor: report.subContractor,
          name: report.name,
          phone: report.phone,
          rank: report.rank,
          location: report.location,
          date: report.date,
          time: report.time,
        }
      }))

      const API_URL = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${API_URL}/api/submit-report`, {
        method: 'POST',
        body: formData
      })
      const result = await res.json()
      return result.message || (result.success ? '발송 완료' : '발송 실패')
    } catch (err) {
      return '서버 연결 실패: ' + err.message
    }
  }

  const handleDownloadPDF = async () => {
    if (submittedReport) {
      const blob = await generatePDF(submittedReport)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `사고발생보고서_${submittedReport.name}_${submittedReport.date}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleShareKakao = async () => {
    if (!submittedReport) return
    try {
      const blob = await generatePDF(submittedReport)
      const fileName = `사고발생보고서_${submittedReport.name}_${submittedReport.date}.pdf`
      const file = new File([blob], fileName, { type: 'application/pdf' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '사고 발생보고서',
          text: `[사고발생보고] ${submittedReport.projectName} - ${submittedReport.name} (${submittedReport.date})`
        })
      } else {
        alert('이 브라우저에서는 공유 기능을 지원하지 않습니다.\nPDF 다운로드 후 카카오톡에서 직접 첨부해주세요.')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('공유 실패:', err)
      }
    }
  }

  const resetForm = () => {
    setForm({ ...initialForm
    })
    setShowModal(false)
    setSubmittedReport(null)
  }

  const auto = getAutoDescription()

  return (
    <div>
      {/* 업무용 차량 사고 체크박스 */}
      <div className="form-section" style={{ background: form.isVehicleAccident ? '#fffff0' : '#fff' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isVehicleAccident}
            onChange={e => update('isVehicleAccident', e.target.checked)}
            style={{ width: '22px', height: '22px', accentColor: '#d69e2e' }}
          />
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#975a16' }}>
            업무용 차량 사고
          </span>
        </label>
        {form.isVehicleAccident && (
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label">차량번호 <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="예: 12가 3456"
              value={form.vehicleNumber}
              onChange={e => update('vehicleNumber', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* 1. 사업명 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">1</span> 사업명 <span className="required">*</span>
        </div>
        <select
          className="form-select"
          value={form.projectName}
          onChange={e => {
            update('projectName', e.target.value)
            update('company', '')
            update('subContractor', '')
          }}
        >
          <option value="">사업명을 선택하세요</option>
          {PROJECT_OPTIONS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* 2. 소속 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">2</span> 소속 <span className="required">*</span>
        </div>
        <select
          className="form-select"
          value={form.company}
          onChange={e => update('company', e.target.value)}
        >
          <option value="">소속을 선택하세요</option>
          {availableCompanies.map(c => (
            <option key={c.label} value={c.label}>{c.label}</option>
          ))}
        </select>
        {form.company && (
          <div className="sub-input-row">
            <span className="sub-label">하도급업체명:</span>
            <input
              type="text"
              className="form-input"
              placeholder="없으면 빈칸 (선택사항)"
              value={form.subContractor}
              onChange={e => update('subContractor', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* 3. 발생장소 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">3</span> 발생장소 <span className="required">*</span>
        </div>
        <input
          type="text"
          className="form-input"
          placeholder="발생장소를 입력하세요"
          value={form.location}
          onChange={e => update('location', e.target.value)}
        />
      </div>

      {/* 4. 일시 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">4</span> 일시 <span className="required">*</span>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">날짜 <span className="required">*</span></label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={e => update('date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">시간</label>
            <input
              type="time"
              className="form-input"
              value={form.time}
              onChange={e => update('time', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 5. 인적사항 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">5</span> 인적사항
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">직급</label>
            <input
              type="text"
              className="form-input"
              placeholder="직급"
              value={form.rank}
              onChange={e => update('rank', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">성명 <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="성명"
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">연락처 (전화번호) <span className="required">*</span></label>
          <input
            type="tel"
            className="form-input"
            placeholder="010-0000-0000"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">생년월일</label>
            <input
              type="date"
              className="form-input"
              value={form.birthDate}
              onChange={e => update('birthDate', e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">동업무경력</label>
          <div className="form-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                min="0"
                value={form.workExperienceYears}
                onChange={e => update('workExperienceYears', e.target.value)}
              />
              <span className="sub-label">년</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                min="0"
                max="11"
                value={form.workExperienceMonths}
                onChange={e => update('workExperienceMonths', e.target.value)}
              />
              <span className="sub-label">월</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. 발생경위 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">6</span> 발생경위
        </div>
        <p style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}>
          아래 내용은 위에서 입력한 정보로 자동 생성됩니다.
        </p>
        <div className="auto-text-preview">
          <span className={form.projectName ? 'filled' : 'placeholder'}>'{auto.project}'</span>
          {form.projectName !== '수도권매립지관리공사' && ' 진행 중'}
          {' '}
          <span className={form.company ? 'filled' : 'placeholder'}>
            '{auto.displayCompany}'
          </span>
          {' '}소속{' '}
          <span className={form.rank ? 'filled' : 'placeholder'}>'{auto.rank}</span>
          {' '}
          <span className={form.name ? 'filled' : 'placeholder'}>{auto.personName}'</span>
          님이{' '}
          <span className={form.location ? 'filled' : 'placeholder'}>'{auto.loc}'</span>
          에서{' '}
          <span className={form.date ? 'filled' : 'placeholder'}>'{auto.dateStr}{auto.timeStr}'</span>
          에
        </div>
        <textarea
          className="form-textarea"
          placeholder="(직접기입) 예: 00 작업을 하다가 00 원인에 의해 다치게 되었음"
          value={form.description}
          onChange={e => update('description', e.target.value)}
          rows={4}
        />
      </div>

      {/* 7. 피해정도 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">7</span> 피해정도 <span className="required">*</span>
        </div>
        <div className="checkbox-group">
          <div className="checkbox-item">
            <input
              type="checkbox"
              checked={form.damageHuman}
              onChange={e => update('damageHuman', e.target.checked)}
            />
            <span className="checkbox-label">인명피해</span>
            {form.damageHuman && (
              <input
                type="text"
                className="form-input"
                placeholder="인명피해 내용 입력"
                value={form.damageHumanDetail}
                onChange={e => update('damageHumanDetail', e.target.value)}
              />
            )}
          </div>
          <div className="checkbox-item">
            <input
              type="checkbox"
              checked={form.damageProperty}
              onChange={e => update('damageProperty', e.target.checked)}
            />
            <span className="checkbox-label">물적피해</span>
            {form.damageProperty && (
              <input
                type="text"
                className="form-input"
                placeholder="물적피해 내용 입력"
                value={form.damagePropertyDetail}
                onChange={e => update('damagePropertyDetail', e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      {/* 8. 조치 및 결과 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">8</span> 조치 및 결과 <span className="required">*</span>
        </div>
        <textarea
          className="form-textarea"
          placeholder="조치 내용 및 결과를 입력하세요"
          value={form.action}
          onChange={e => update('action', e.target.value)}
          rows={3}
        />
      </div>

      {/* 9. 첨부파일 */}
      <div className="form-section">
        <div className="form-section-title">
          <span className="num">9</span> 현장 및 피해사진 첨부 <span className="required">*</span>
        </div>
        <div
          className="photo-upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="photo-upload-icon">&#x1F4F7;</div>
          <div className="photo-upload-text">
            탭하여 사진을 추가하세요<br />
            (카메라 촬영 또는 갤러리에서 선택)
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handlePhotoAdd}
        />
        {form.photos.length > 0 && (
          <div className="photo-preview-grid">
            {form.photos.map((photo, idx) => (
              <div key={idx} className="photo-preview-item">
                <img src={photo.data} alt={photo.name} />
                <button
                  className="photo-remove-btn"
                  onClick={() => removePhoto(idx)}
                >
                  &#x2715;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 10. 개인정보 수집 동의 */}
      <div className="form-section" style={{ border: form.privacyAgreed ? '1px solid #c6f6d5' : '1px solid #e2e8f0' }}>
        <div className="form-section-title">
          <span className="num">10</span> 개인정보 수집 동의 <span className="required">*</span>
        </div>
        <div
          onClick={() => update('showPrivacy', !form.showPrivacy)}
          style={{
            padding: '10px 12px', background: '#f8fafc', borderRadius: '6px',
            fontSize: '13px', color: '#2b6cb0', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: form.showPrivacy ? '10px' : '0'
          }}
        >
          <span>개인정보 수집 · 이용 동의서 전문 보기</span>
          <span style={{ fontSize: '16px' }}>{form.showPrivacy ? '▲' : '▼'}</span>
        </div>
        {form.showPrivacy && (
          <div style={{
            padding: '14px', background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: '8px', fontSize: '12px', color: '#4a5568',
            lineHeight: 1.8, marginBottom: '12px', maxHeight: '300px', overflowY: 'auto'
          }}>
            <p style={{ fontWeight: '700', fontSize: '14px', textAlign: 'center', marginBottom: '12px', color: '#1a365d' }}>
              개인정보 수집 · 이용 동의서
            </p>
            <p>수도권매립지관리공사는 현장 안전사고 발생 시 신속한 보고 및 재발방지 관리를 위하여 아래와 같이 개인정보를 수집 · 이용하고자 합니다. 「개인정보 보호법」 제15조 제1항 제1호에 따라 정보주체의 동의를 받아 수집하오니, 아래 내용을 충분히 읽으신 후 동의 여부를 결정하여 주시기 바랍니다.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0', fontSize: '12px' }}>
              <tbody>
                <tr><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', background: '#f0f4f8', fontWeight: '600', width: '100px' }}>수집 목적</td><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>현장 안전사고 보고, 재해자 보호조치, 재발방지 대책 수립 및 관리</td></tr>
                <tr><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', background: '#f0f4f8', fontWeight: '600' }}>수집 항목</td><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>성명, 소속(업체명), 휴대폰 번호, 사고 관련 상황(사고일시, 장소, 경위, 부상 부위 등)</td></tr>
                <tr><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', background: '#f0f4f8', fontWeight: '600' }}>보유 및 이용 기간</td><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>수집일로부터 3년 (보유기간 경과 후 지체 없이 파기)</td></tr>
                <tr><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', background: '#f0f4f8', fontWeight: '600' }}>제3자 대리 입력</td><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>사고 발생 시 본인이 직접 보고할 수 없는 경우, 현장 관계자가 사고보고 앱을 통해 본인의 개인정보를 대리 입력할 수 있습니다.</td></tr>
                <tr><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', background: '#f0f4f8', fontWeight: '600' }}>동의 거부 권리</td><td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>귀하는 위 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 다만, 동의를 거부하실 경우 사고 발생 시 신속한 보고 및 보호조치에 제한이 있을 수 있습니다.</td></tr>
              </tbody>
            </table>
            <p>본인은 위와 같이 개인정보를 수집·이용하는 것에 동의하며, 사고 발생 시 제3자가 본인의 개인정보를 대리 입력하는 것에 동의합니다.</p>
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '4px 0' }}>
          <input
            type="checkbox"
            checked={form.privacyAgreed || false}
            onChange={e => update('privacyAgreed', e.target.checked)}
            style={{ width: '22px', height: '22px', accentColor: '#1a365d' }}
          />
          <span style={{ fontSize: '14px', fontWeight: '600', color: form.privacyAgreed ? '#276749' : '#4a5568' }}>
            개인정보 수집 · 이용에 동의합니다
          </span>
        </label>
      </div>

      <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
        {submitting ? '제출 중...' : '보고서 제출'}
      </button>

      {/* 제출 완료 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#x2705;</div>
            <h3>보고서가 제출되었습니다</h3>
            {sendResult && (
              <div style={{
                padding: '8px 12px', borderRadius: '6px', marginBottom: '12px',
                fontSize: '13px',
                background: sendResult.includes('실패') || sendResult.includes('오류') ? '#fed7d7' : '#c6f6d5',
                color: sendResult.includes('실패') || sendResult.includes('오류') ? '#c53030' : '#276749'
              }}>
                {sendResult}
              </div>
            )}
            <button
              className="modal-btn"
              onClick={handleShareKakao}
              style={{ marginBottom: '8px', background: '#FEE500', color: '#191919' }}
            >
              카카오톡으로 공유
            </button>
            <button className="modal-btn" onClick={handleDownloadPDF} style={{ marginBottom: '8px' }}>
              PDF 다운로드
            </button>
            <button
              className="modal-btn"
              onClick={resetForm}
              style={{ background: '#edf2f7', color: '#4a5568' }}
            >
              새 보고서 작성
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
