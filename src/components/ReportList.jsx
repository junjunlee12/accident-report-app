import { useState, useEffect } from 'react'
import { getReports } from '../utils/storage'
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
      <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#1a365d' }}>
        제출 내역 ({reports.length}건)
      </h2>

      {reports.map(report => (
        <div key={report.id} className="report-card">
          <div className="report-card-header">
            <span className="report-card-title">{report.projectName}</span>
            <span className={`status-badge ${report.status === 'sent' ? 'status-sent' : 'status-pending'}`}>
              {report.status === 'sent' ? '발송완료' : '대기중'}
            </span>
          </div>
          <div className="report-card-info">
            <div><strong>소속:</strong> {report.company}{report.subContractor ? ` / ${report.subContractor}` : ''}</div>
            <div><strong>성명:</strong> {report.rank} {report.name}</div>
            <div><strong>일시:</strong> {report.date} {report.time}</div>
            <div><strong>장소:</strong> {report.location}</div>
          </div>
          <div className="report-card-actions">
            <button className="btn-pdf" onClick={() => handleDownload(report)}>
              PDF 다운로드
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
