// AdminTools.jsx - [2026-11-01] 관리자 대시보드 '설정·도구' 추가 카드(2차 점검 운영 B)
//  - B16 대시보드 기준값(운동 없음 일수·PT 적음 횟수·만료 임박 일수, settings/app)
//  - B2 이 기기 오늘 읽기 횟수(근사)와 Spark 한도 안내
//  - B1 헬스장 전체 백업(JSON 내려받기, 운동 기록 내용 제외, 복구 화면 없음)
//  - B3 2년 지난 관리 이력 정리 · B12 탈퇴 회원 메모 정리 · B28 지난 시즌 랭킹 정리
//  - B24 첫 관리자·관리자 복구는 콘솔에서만(관리자 2명 이상 권장) 안내
import React, { useState } from 'react'
import { Button, Card, Chip, useConfirm } from './ui'
import { selectStyle } from './adminUi'
import { adminApproveMany, adminClearMembershipDates, adminExportAll, adminPurgeOldLogs, adminDeleteNotes, adminPurgeOldSeasons, getDeviceReadsToday, logAdmin, BACKUP_COLLECTIONS } from '../storage'
import { downloadText } from '../utils/exportCsv'
import { todayStr } from '../utils/date'
import { GYM_KINDS, GYM_LABEL, gymItemCandidates, normalizeGymEquip } from '../utils/gymEquip'
import { APP_MODES, isGymMode, normalizeAppSettings, setAppSettingsLocal } from '../utils/appSettings'

export const DASH_DEFAULTS = { staleDays: 14, ptLowCount: 3, expireSoonDays: 7, riskAwayDays: 14, riskHighDays: 21 }
export const dashSetting = (settings, k) => {
  const v = Number(settings?.[k])
  return Number.isInteger(v) && v >= 1 && v <= 365 ? v : DASH_DEFAULTS[k]
}
const title = { margin: 0, fontSize: 16.5, fontWeight: 700 }
const desc = { margin: '4px 0 10px', fontSize: 14.5, color: 'var(--color-label-neutral)' }

export default function AdminTools({ users, notes, settings, admin, onSettings, onNotesDeleted }) {
  const confirm = useConfirm()
  const [vals, setVals] = useState(() => Object.fromEntries(Object.keys(DASH_DEFAULTS).map((k) => [k, String(dashSetting(settings, k))])))
  const [msg, setMsg] = useState({})
  const [busy, setBusy] = useState('')
  const say = (k, m) => setMsg((x) => ({ ...x, [k]: m }))
  const orphanNotes = Object.keys(notes || {}).filter((id) => !(users || []).some((u) => u.uid === id))
  const reads = getDeviceReadsToday()

  async function saveDash() {
    const patch = {}
    for (const k of Object.keys(DASH_DEFAULTS)) {
      const n = Math.round(Number(vals[k]))
      if (!Number.isInteger(n) || n < 1 || n > 365) return say('dash', '1~365 사이 숫자로 적어 주세요.')
      patch[k] = n
    }
    if (patch.riskHighDays <= patch.riskAwayDays) return say('dash', "'위험 높음' 일수는 '관리 필요' 일수보다 커야 해요.")
    const ok = await onSettings(patch, `대시보드 기준: 운동 없음 ${patch.staleDays}일 · PT ${patch.ptLowCount}회 이하 · 만료 ${patch.expireSoonDays}일 안 · 이탈 위험 ${patch.riskAwayDays}/${patch.riskHighDays}일`)
    say('dash', ok ? '저장했어요.' : '')
  }
  async function exportAll() {
    if (!(await confirm(`헬스장 데이터 전체(${BACKUP_COLLECTIONS.length}개 묶음)를 JSON 파일로 내려받아요. 문서 수만큼 읽기가 생겨요(회원 수의 몇 배). 운동 기록 내용은 들어가지 않아요. 파일에 개인정보가 있으니 안전한 곳에 보관해 주세요.`, { okLabel: '내려받기', cancelLabel: '취소' }))) return
    setBusy('export')
    try {
      const data = await adminExportAll((name) => say('export', `${name} 읽는 중…`))
      const count = Object.values(data.collections).reduce((s, c) => s + (c.__error ? 0 : Object.keys(c).length), 0)
      downloadText(`bodytailor-backup-${todayStr().replace(/-/g, '')}.json`, JSON.stringify(data, null, 1), 'application/json;charset=utf-8')
      await logAdmin(admin, { action: 'export', detail: `전체 백업 JSON 내려받기(문서 ${count}개)` })
      const errs = Object.entries(data.collections).filter(([, c]) => c.__error).map(([k]) => k)
      say('export', `문서 ${count}개를 내려받았어요.${errs.length ? ` 읽지 못한 묶음: ${errs.join(', ')}` : ''}`)
    } catch (err) {
      console.error('전체 백업 실패:', err)
      say('export', '내려받지 못했어요.')
    } finally {
      setBusy('')
    }
  }
  async function purgeLogs() {
    if (!(await confirm('2년이 지난 관리 이력을 지울까요? 되돌릴 수 없어요(처리방침의 보존 기간).', { okLabel: '지우기', cancelLabel: '취소' }))) return
    setBusy('logs')
    try {
      const n = await adminPurgeOldLogs()
      if (n) await logAdmin(admin, { action: 'settings', detail: `보존 기간 지난 관리 이력 ${n}건 정리` })
      say('logs', n ? `${n}건을 지웠어요.` : '2년 지난 이력이 없어요.')
    } catch (err) {
      console.error('이력 정리 실패:', err)
      say('logs', '지우지 못했어요. Firebase 규칙 게시를 확인해 주세요.')
    } finally {
      setBusy('')
    }
  }
  async function purgeNotes() {
    if (!orphanNotes.length) return
    if (!(await confirm(`탈퇴해 계정이 없는 회원의 관리자 메모·재등록 기록 ${orphanNotes.length}건을 지울까요?`, { okLabel: '지우기', cancelLabel: '취소' }))) return
    setBusy('notes')
    try {
      await adminDeleteNotes(orphanNotes)
      await logAdmin(admin, { action: 'memo', detail: `탈퇴 회원 메모 ${orphanNotes.length}건 정리` })
      onNotesDeleted?.(orphanNotes)
      say('notes', '지웠어요.')
    } catch (err) {
      console.error('메모 정리 실패:', err)
      say('notes', '지우지 못했어요.')
    } finally {
      setBusy('')
    }
  }
  async function purgeSeasons() {
    if (!(await confirm('이번 시즌을 뺀 지난 시즌 랭킹(최근 3년)을 지울까요? 회원 화면 랭킹은 이번 시즌만 보여서 영향이 없어요. 문서 수만큼 읽기·삭제가 생겨요.', { okLabel: '지우기', cancelLabel: '취소' }))) return
    setBusy('seasons')
    try {
      const n = await adminPurgeOldSeasons()
      if (n) await logAdmin(admin, { action: 'settings', detail: `지난 시즌 랭킹 ${n}건 정리` })
      say('seasons', n ? `${n}건을 지웠어요.` : '지울 지난 시즌 랭킹이 없어요.')
    } catch (err) {
      console.error('랭킹 정리 실패:', err)
      say('seasons', '지우지 못했어요. Firebase 규칙 게시를 확인해 주세요.')
    } finally {
      setBusy('')
    }
  }
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 15.5, width: 90 }
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }
  const note = (k) => (msg[k] ? <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 14.5, color: 'var(--color-label-normal)' }}>{msg[k]}</p> : null)
  return (
    <>
      {isGymMode(normalizeAppSettings(settings)) && <GymEquipCard settings={settings} onSettings={onSettings} />}
      <Card>
        <p style={title}>대시보드 기준값</p>
        <p className="text-keep-all" style={desc}>대시보드 요약의 '운동 없음'·'PT 적음'·'만료 임박' 기준이에요.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={lab}>운동 없음(일)<input type="number" min="1" max="365" inputMode="numeric" value={vals.staleDays} onChange={(e) => setVals((v) => ({ ...v, staleDays: e.target.value }))} style={inputStyle} /></label>
          <label style={lab}>남은 PT(회 이하)<input type="number" min="1" max="365" inputMode="numeric" value={vals.ptLowCount} onChange={(e) => setVals((v) => ({ ...v, ptLowCount: e.target.value }))} style={inputStyle} /></label>
          <label style={lab}>만료 임박(일 안)<input type="number" min="1" max="365" inputMode="numeric" value={vals.expireSoonDays} onChange={(e) => setVals((v) => ({ ...v, expireSoonDays: e.target.value }))} style={inputStyle} /></label>
        </div>
        <p className="text-keep-all" style={{ ...desc, margin: '14px 0 8px' }}>이탈 위험 표시: 마지막 운동부터 이 일수가 지나면 '관리 필요', 더 지나면 '위험 높음'이에요(가입 후 기록이 없는 회원도 같은 기준).</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={lab}>관리 필요(일)<input type="number" min="1" max="365" inputMode="numeric" value={vals.riskAwayDays} onChange={(e) => setVals((v) => ({ ...v, riskAwayDays: e.target.value }))} style={inputStyle} /></label>
          <label style={lab}>위험 높음(일)<input type="number" min="1" max="365" inputMode="numeric" value={vals.riskHighDays} onChange={(e) => setVals((v) => ({ ...v, riskHighDays: e.target.value }))} style={inputStyle} /></label>
          <Button onClick={saveDash}>저장</Button>
        </div>
        {note('dash')}
      </Card>
      <Card>
        <p style={title}>사용량(Firebase 무료 한도)</p>
        <p className="text-keep-all" style={{ ...desc, marginBottom: 0 }}>
          이 기기에서 오늘 서버에서 읽은 문서: 약 <b className="bt-num" style={{ color: 'var(--color-label-strong)' }}>{reads.toLocaleString()}</b>개. 전체 한도는 모든 기기 합쳐 하루 읽기 5만·쓰기 2만이에요(한국 시간 오후 4~5시에 초기화). 정확한 값은 Firebase 콘솔 › Firestore › 사용량에서 봐요. 하루 3만을 자주 넘으면 Blaze 요금제와 예산 알림을 검토해 주세요.
        </p>
      </Card>
      <Card>
        <p style={title}>헬스장 전체 백업</p>
        <p className="text-keep-all" style={desc}>회원·명단·연결·PT·메모·이력·문의·설정을 JSON 파일 하나로 내려받아요(운동 기록 내용 제외). 복구는 앱에서 하지 않고, 필요하면 이 파일로 콘솔·스크립트에서 되살려요. 한 달에 한 번 정도 권장해요.</p>
        <Button variant="secondary" disabled={busy === 'export'} onClick={exportAll}>{busy === 'export' ? '내려받는 중…' : '전체 내보내기(JSON)'}</Button>
        {note('export')}
      </Card>
      <Card>
        <p style={title}>데이터 정리</p>
        <p className="text-keep-all" style={desc}>관리 이력은 2년 보관 뒤 지울 수 있어요(처리방침). 탈퇴 회원의 관리자 메모와 지난 시즌 랭킹도 여기서 정리해요.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={!!busy} onClick={purgeLogs}>2년 지난 관리 이력 지우기</Button>
          <Button variant="secondary" disabled={!!busy || !orphanNotes.length} onClick={purgeNotes}>탈퇴 회원 메모 {orphanNotes.length}건 지우기</Button>
          <Button variant="secondary" disabled={!!busy} onClick={purgeSeasons}>지난 시즌 랭킹 지우기</Button>
        </div>
        {note('logs')}
        {note('notes')}
        {note('seasons')}
      </Card>
      <Card>
        <p style={title}>관리자 계정 안내</p>
        <p className="text-keep-all" style={{ ...desc, marginBottom: 0 }}>
          첫 관리자 지정과 관리자 계정 복구는 Firebase 콘솔에서만 할 수 있어요(Firestore › users › 그 계정 문서 › role을 '관리자'로). 한 사람이 계정을 잃으면 대시보드를 못 쓰게 되니 관리자는 2명 이상 두세요.
        </p>
      </Card>
    </>
  )
}

// [2026-11-13] 센터 보유 기구: 회원 HOWTO에 '보유' 표시·'보유 기구만' 거르기. 종류는 있음/없음, 머신·유산소는 종목별.
function GymEquipCard({ settings, onSettings }) {
  const [sel, setSel] = useState(() => normalizeGymEquip(settings?.gymEquip))
  const [msg, setMsg] = useState('')
  const groups = gymItemCandidates()
  const toggle = (key, v) => {
    setMsg('')
    setSel((x) => ({ ...x, [key]: x[key].includes(v) ? x[key].filter((y) => y !== v) : [...x[key], v] }))
  }
  const setGroup = (names, on) => {
    setMsg('')
    setSel((x) => ({ ...x, items: on ? [...new Set([...x.items, ...names])] : x.items.filter((n) => !names.includes(n)) }))
  }
  async function save() {
    const v = normalizeGymEquip(sel)
    const ok = await onSettings({ gymEquip: v }, `보유 기구: 종류 ${v.kinds.length}가지 · 머신·유산소 ${v.items.length}종목`)
    if (ok) setAppSettingsLocal({ gymEquip: v })
    setMsg(ok ? '저장했어요. 회원 화면에는 다음에 앱을 열 때(최대 6시간 뒤) 반영돼요.' : '')
  }
  const sub = { margin: '14px 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--color-label-normal)', display: 'flex', alignItems: 'center', gap: 8 }
  const mini = { fontSize: 13, fontWeight: 600, color: 'var(--color-label-neutral)', textDecoration: 'underline' }
  return (
    <Card>
      <p style={title}>{GYM_LABEL} 기구</p>
      <p className="text-keep-all" style={desc}>센터에 있는 기구를 고르면 회원 HOWTO 운동 목록에 '{GYM_LABEL}' 표시와 '{GYM_LABEL} 기구만' 거르기가 생겨요. 맨몸 운동은 늘 할 수 있는 것으로 봐요. 아무것도 고르지 않으면 표시하지 않아요.</p>
      <p style={sub}>기구 종류</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {GYM_KINDS.map((k) => <Chip key={k} active={sel.kinds.includes(k)} onClick={() => toggle('kinds', k)}>{k}</Chip>)}
      </div>
      {groups.map((g) => (
        <div key={g.kind}>
          <p style={sub}>
            {g.kind} ({g.names.filter((n) => sel.items.includes(n)).length}/{g.names.length})
            <button type="button" style={mini} onClick={() => setGroup(g.names, true)}>모두</button>
            <button type="button" style={mini} onClick={() => setGroup(g.names, false)}>비우기</button>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {g.names.map((n) => <Chip key={n} active={sel.items.includes(n)} onClick={() => toggle('items', n)}>{n}</Chip>)}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14 }}><Button onClick={save}>저장</Button></div>
      {msg && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 14.5, color: 'var(--color-label-normal)' }}>{msg}</p>}
    </Card>
  )
}

// [2026-11-13] 앱 운영 방식: 타입 1 헬스장형 / 타입 2 일반형 + (헬스장형) 회원권·PT를 다른 시스템에서 관리
export function AppModeCard({ users, settings, admin, onSettings, onUsersChanged }) {
  const confirm = useConfirm()
  const cfg = normalizeAppSettings(settings)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const members = (users || []).filter((u) => u.role !== '트레이너')
  async function run(fn) {
    setBusy(true)
    setMsg('')
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  async function saveCfg(patch, label) {
    const ok = await onSettings(patch, label)
    if (ok) setAppSettingsLocal(patch)
    return ok
  }
  const setMode = (mode) => run(async () => {
    if (mode === cfg.appMode) return
    if (mode === 'open') {
      if (!(await confirm('일반형으로 바꿀까요? 누구나 가입하면 바로 쓸 수 있고, 트레이너 연결·트레이너 소개·PT·회원권·보유 기구 화면이 숨겨져요. 기존 연결·PT 기록은 지우지 않아요(다시 헬스장형으로 바꾸면 그대로).', { okLabel: '일반형으로', cancelLabel: '취소' }))) return
    } else if (!(await confirm('헬스장형으로 바꿀까요? 새 가입은 관리자 승인 뒤에 쓸 수 있어요.', { okLabel: '헬스장형으로', cancelLabel: '취소' }))) return
    if (!(await saveCfg({ appMode: mode }, `앱 운영 방식: ${APP_MODES[mode]}`))) return
    let text = '저장했어요. 다른 기기에는 다음에 앱을 열 때(최대 6시간 뒤) 반영돼요.'
    const waiting = members.filter((u) => ['pending', 'rejected'].includes(u.memberStatus))
    if (mode === 'open' && waiting.length && (await confirm(`승인 대기·거절 상태인 ${waiting.length}명이 있어요. 모두 승인할까요?`, { okLabel: '모두 승인', cancelLabel: '그대로 두기' }))) {
      try {
        await adminApproveMany(waiting.map((u) => u.uid), admin?.uid)
        await logAdmin(admin, { action: 'settings', detail: `일반형 전환: 대기·거절 ${waiting.length}명 승인` })
        await onUsersChanged?.()
        text += ` ${waiting.length}명을 승인했어요.`
      } catch (err) {
        console.error('일괄 승인 실패:', err)
        text += ' 일괄 승인은 실패했어요. 승인 대기 탭에서 다시 해 주세요.'
      }
    }
    setMsg(text)
  })
  const setExternal = (on) => run(async () => {
    if (on === cfg.membershipExternal) return
    if (!(await saveCfg({ membershipExternal: on }, `회원권·PT 관리: ${on ? '다른 시스템' : '이 앱'}`))) return
    let text = on ? "저장했어요. 회원권 기간·PT 횟수·PT 일정 화면을 숨겼어요." : '저장했어요. 회원권·PT 화면이 다시 보여요.'
    const dated = members.filter((u) => u.membershipEnd || u.membershipEndAt)
    if (on && dated.length && (await confirm(`회원권 종료일이 들어 있는 회원 ${dated.length}명이 있어요. 종료일이 지나면 기록 저장이 막히니 비울까요? (PT 횟수는 그대로 둬요)`, { okLabel: '비우기', cancelLabel: '그대로 두기' }))) {
      try {
        await adminClearMembershipDates(dated.map((u) => u.uid))
        await logAdmin(admin, { action: 'settings', detail: `회원권 종료일 ${dated.length}명 비움(다른 시스템에서 관리)` })
        await onUsersChanged?.()
        text += ` ${dated.length}명의 종료일을 비웠어요.`
      } catch (err) {
        console.error('회원권 종료일 비우기 실패:', err)
        text += ' 종료일 비우기는 실패했어요.'
      }
    }
    setMsg(text)
  })
  const opt = (on) => ({ flex: 1, minHeight: 44, borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 700, border: on ? '2px solid var(--color-label-strong)' : '1px solid var(--color-line)', background: on ? 'var(--color-bg-elevated)' : 'transparent', color: 'var(--color-label-strong)' })
  return (
    <Card>
      <p style={title}>앱 운영 방식</p>
      <p className="text-keep-all" style={desc}>헬스장형은 승인한 회원·트레이너가 함께 써요(트레이너 연결·PT·회원권·보유 기구). 일반형은 누구나 가입하면 바로 쓰는 개인 운동 앱이에요.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.entries(APP_MODES).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={cfg.appMode === k} disabled={busy} onClick={() => setMode(k)} style={opt(cfg.appMode === k)}>{l}</button>
        ))}
      </div>
      {cfg.appMode === 'gym' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>회원권·PT는 다른 시스템에서 관리</p>
            <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-label-neutral)' }}>출입·회원권 프로그램을 따로 쓰면 켜요. 회원권 기간·PT 횟수·PT 일정 화면을 숨기고, 트레이너 연결·계획은 그대로 써요.</p>
          </div>
          <Button variant={cfg.membershipExternal ? 'primary' : 'ghost'} disabled={busy} style={{ flexShrink: 0 }} onClick={() => setExternal(!cfg.membershipExternal)}>
            {cfg.membershipExternal ? '켜짐' : '꺼짐'}
          </Button>
        </div>
      )}
      {msg && <p className="text-keep-all" style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--color-label-normal)' }}>{msg}</p>}
    </Card>
  )
}
