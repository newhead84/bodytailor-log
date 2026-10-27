// exportCsv.js
// [2026-10-27 신규, 리뉴얼 W2] 운동 기록 CSV 내보내기 — 세트 단위 1행. 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 포함.
import { SET_TYPE_LABEL } from './strength'

const HEADER = ['날짜', '종목', '그립', '부위', '세트', '종류', '무게(kg)', '횟수', 'RIR', '시간(분)', '속도', '경사(%)', '스텝수', '세션구분', '자동저장']

function cell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function logsToCsv(logs) {
  const rows = [HEADER]
  ;(logs || []).forEach((log) => {
    ;(log.exercises || []).forEach((ex) => {
      ;(ex.sets || []).forEach((s, i) => {
        rows.push([
          log.date,
          ex.name,
          ex.grip || '',
          ex.part || '',
          i + 1,
          SET_TYPE_LABEL[s.type || 'working'],
          ex.inputType === 'cardio' ? '' : s.weight ?? '',
          ex.inputType === 'cardio' ? '' : s.reps ?? '',
          s.rir ?? '',
          s.durationMin ?? '',
          s.speedKmh ?? '',
          s.incline ?? '',
          s.steps ?? '',
          log.sessionType === 'extra' ? '자유운동' : '루틴',
          log.autoFinalized ? 'Y' : '',
        ])
      })
    })
  })
  return '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
