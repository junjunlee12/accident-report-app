import { useState, useEffect } from 'react'
import { getReports, deleteReport, clearAllReports } from '../utils/storage'
import { generatePDF } from '../utils/pdfGenerator'

export default function ReportList() {
  const [reports, setReports] = useState([])

  useEffect(() => {
    setReports(getReports())
  }, [])

  const handleDownload = async (report) => {
    const blob = await generatePDF(report)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `사고발생보고서_${report.name}_${report.date}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = (id) => {
    if (confirm('이 보고서를 삭제하시겠습니까?')) {
      deleteReport(id)
      setReports(getReports())
    }
  }

  const handleClearAll = () => {
    if (confirm('모든 제출 내역을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      clearAllReports()
      setReports([])
    }
  }

  if (reports.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#x1F4C4;</div>
        <p>제출된 보고서가 없습니다.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', color: '#1a365d' }}>
          제출 내역 ({reports.length}건)
        </h2>
        <button
          onClick={handleClearAll}
          style={{
            padding: '6px 12px', background: '#fff5f5', border: '1px solid #fed7d7',
            borderRadius: '6px', fontSize: '11px', cursor: 'pointer', color: '#e53e3e',
            fontFamily: 'inherit'
          }}
        >
          전체 삭제
        </button>
      </div>

      {reports.map(report => (
        <div key={report.id} className="report-card">
          <div className="report-card-header">
            <span className="report-card-title">{report.projectName}</span>
            <span className="report-card-date">
              {report.createdAt ? new Date(report.createdAt).toLocaleDateString('ko-KR') : ''}
            </span>
          </div>
          <div className="report-card-info">
            <div><strong>소속:</strong> {report.displayCompany || report.company}</div>
            <div><strong>성명:</strong> {report.rank} {report.name}</div>
            <div><strong>연락처:</strong> {report.phone || '-'}</div>
            <div><strong>일시:</strong> {report.date} {report.time}</div>
            <div><strong>장소:</strong> {report.location}</div>
          </div>
          <div className="report-card-actions">
            <button className="btn-pdf" onClick={() => handleDownload(report)}>
              PDF 다운로드
            </button>
            <button
              className="btn-pdf"
              onClick={() => handleDelete(report.id)}
              style={{ color: '#e53e3e', borderColor: '#fed7d7' }}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
