// member.js
// [2026-10-31 신규, Phase2 P2-1] 헬스장 회원 승인·명단 이관 공용 유틸.
//  - 전화번호는 원문을 저장하지 않는다: 숫자만 남겨 정규화 → SHA-256 해시 + 뒤 4자리만 저장(명단 대조용).
//  - 명단 CSV: 출입관리 프로그램에서 내보낸 엑셀을 CSV로 저장한 파일. 한글 엑셀 CSV는 CP949(EUC-KR)인 경우가 많아
//    UTF-8로 먼저 읽고 깨지면 EUC-KR로 다시 읽는다. 파일은 브라우저 안에서만 읽는다.

export const MEMBER_STATUS = { pending: '승인 대기', approved: '승인', rejected: '거절', expired: '만료' }
export const MEMBER_ROLES = ['일반회원', 'PT회원', '트레이너', '관리자']

// 기존 계정(필드 없음)은 승인된 것으로 본다. 관리자는 항상 사용 가능.
export function isApprovedMember(userDoc) {
  if (!userDoc) return false
  if (userDoc.role === '관리자') return true
  return !userDoc.memberStatus || userDoc.memberStatus === 'approved'
}

// 010-1234-5678 / +82 10 1234 5678 / 01012345678 → 01012345678
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('82') && d.length >= 11) d = '0' + d.slice(2)
  return d
}
export function isValidMobile(raw) {
  return /^01[016789]\d{7,8}$/.test(normalizePhone(raw))
}
export function phoneLast4(raw) {
  return normalizePhone(raw).slice(-4)
}
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
// 앱 고정 접두어를 붙여 해시(같은 번호는 항상 같은 해시 — 명단 대조용)
export async function phoneHash(raw) {
  const p = normalizePhone(raw)
  return p ? sha256Hex(`bodytailor-log:${p}`) : ''
}
export function normalizeName(s) {
  return String(s || '').replace(/\s+/g, '').trim()
}

// ───────── CSV ─────────
export function decodeCsvBuffer(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('euc-kr').decode(buffer)
  }
}
// 따옴표·쉼표·줄바꿈을 지원하는 간단한 CSV 파서 → string[][]
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((v) => v.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v.trim() !== '')) rows.push(row)
  return rows.map((r) => r.map((v) => v.trim()))
}
// 헤더 이름으로 열 자동 추정
export function guessColumns(headers) {
  const find = (re) => headers.findIndex((h) => re.test(String(h).replace(/\s/g, '')))
  return {
    name: find(/^(회원명|이름|성명|고객명|name)$/i),
    phone: find(/(휴대폰|핸드폰|전화|연락처|phone|mobile)/i),
    memberNo: find(/^(회원번호|회원no|회원id|회원코드|memberno|no|id)$/i), // '전화번호'가 잡히지 않게 정확히 일치만
    expireDate: find(/(만료|종료|마감|유효|expire|end)/i),
  }
}
// 2026.12.31 / 2026-12-31 / 20261231 / 2026/12/31 → '2026-12-31' (알 수 없으면 '')
export function normalizeDate(s) {
  const d = String(s || '').replace(/[^\d]/g, ' ').trim().split(/\s+/)
  let y, m, day
  if (d.length >= 3) [y, m, day] = d
  else if (d.length === 1 && d[0].length === 8) [y, m, day] = [d[0].slice(0, 4), d[0].slice(4, 6), d[0].slice(6, 8)]
  else return ''
  if (y.length === 2) y = '20' + y
  const mm = String(Number(m)).padStart(2, '0')
  const dd = String(Number(day)).padStart(2, '0')
  if (!(Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31)) return ''
  return `${y}-${mm}-${dd}`
}
// 명단 문서 ID: 회원번호가 있으면 그것, 없으면 전화 해시 앞 20자
export function rosterDocId(row) {
  const no = String(row.memberNo || '').replace(/[^\w-]/g, '')
  return no ? `no_${no}` : `ph_${String(row.phoneHash || '').slice(0, 20)}`
}
