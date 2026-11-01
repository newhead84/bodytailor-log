// HomePtCards.jsx - [2026-11-01] HOME에 한 줄로 그리는 PT 카드(HomeTab은 이 컴포넌트만 렌더)
//  - 회원: B20 트레이너가 PT 일정을 등록·변경·취소하면 '새 PT 일정/변경됨' 알림(users.ptLastChange vs 이 기기에서 확인한 시각)
//  - 트레이너: B18 오늘 PT 카드(완료·노쇼·다음 주 같은 시간 한 번에 예약)
import React, { useCallback, useEffect, useState } from 'react'
import { Card, Button, useConfirm } from './ui'
import { getAppSettings, getUserDoc, listMyTrainees, listTrainerSchedulesByDates, trainerAddSchedule, trainerCompleteSchedule, trainerNoShowSchedule, logAction, invalidateTraineeSummary } from '../storage'
import { todayStr } from '../utils/date'
import { addDays } from '../utils/member'

const DAY = ['일', '월', '화', '수', '목', '금', '토']
const fmtDay = (s) => {
  const [y, m, d] = String(s).split('-').map(Number)
  return `${m}/${d}(${DAY[new Date(y, m - 1, d).getDay()]})`
}
const tsMs = (t) => (t?.toMillis ? t.toMillis() : typeof t?.seconds === 'number' ? t.seconds * 1000 : 0)

export default function HomePtCards({ uid, userDoc }) {
  if (!uid || !userDoc) return null
  if (userDoc.role === '트레이너') return <TrainerTodayPt uid={uid} trainerName={userDoc.signupInfo?.name || userDoc.nickname || ''} />
  return <PtChangeNotice uid={uid} change={userDoc.ptLastChange} />
}

const KIND = { new: '새 PT 일정을 잡았어요', change: 'PT 일정을 바꿨어요', cancel: 'PT 일정을 취소했어요' }
function PtChangeNotice({ uid, change }) {
  const key = `bt-pt-seen-${uid}`
  const at = tsMs(change?.at)
  const [seen, setSeen] = useState(() => {
    try {
      return Number(localStorage.getItem(key)) || 0
    } catch (e) {
      return 0
    }
  })
  // 처음 보는 기기에서 2주 넘은 알림은 띄우지 않는다
  if (!at || at <= seen || Date.now() - at > 14 * 86400000) return null
  const dismiss = () => {
    try {
      localStorage.setItem(key, String(at))
    } catch (e) {
      // 저장이 안 되면 이번 화면에서만 닫는다
    }
    setSeen(at)
  }
  return (
    <Card style={{ marginBottom: 20, border: '1px solid var(--color-fill-strong)' }}>
      <p className="text-keep-all" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>담당 트레이너가 {KIND[change.kind] || 'PT 일정을 바꿨어요'}</p>
      <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>아래 캘린더의 PT 표시와 '다음 PT'에서 확인해 주세요.</p>
      <div style={{ marginTop: 12 }}>
        <Button variant="secondary" onClick={dismiss}>확인</Button>
      </div>
    </Card>
  )
}

function TrainerTodayPt({ uid, trainerName }) {
  const confirm = useConfirm()
  const today = todayStr()
  const [items, setItems] = useState(null)
  const [names, setNames] = useState({})
  const [settings, setSettings] = useState({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const trainer = { uid, name: trainerName }
  const load = useCallback(() => {
    listTrainerSchedulesByDates(uid, [today])
      .then(setItems)
      .catch((err) => {
        console.error('오늘 PT 불러오기 실패:', err)
        setItems([])
      })
  }, [uid, today])
  useEffect(() => {
    load()
    getAppSettings().then((s) => setSettings(s || {})).catch(() => {})
    listMyTrainees(uid)
      .then((l) => setNames(Object.fromEntries(l.map((c) => [c.memberUid, c.memberName]))))
      .catch(() => {})
  }, [uid, load])
  if (!items || !items.length) return null
  const nameOf = (s) => s.memberName || names[s.memberUid] || '회원'
  const ptLog = (s, detail) => logAction({ action: 'pt', targetUid: s.memberUid, targetName: names[s.memberUid] || s.memberName || '', detail })
  async function run(s, fn, logDetail, done) {
    setBusy(s.id)
    setMsg('')
    try {
      await fn()
      if (logDetail) await ptLog(s, logDetail)
      invalidateTraineeSummary(s.memberUid)
      setMsg(done)
      load()
    } catch (err) {
      console.error('오늘 PT 처리 실패:', err)
      await confirm('처리하지 못했어요. 연결 상태와 남은 횟수를 확인해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy('')
    }
  }
  async function complete(s) {
    const deductOn = !!settings.ptDeductEnabled
    let member = null
    if (deductOn) member = await getUserDoc(s.memberUid).catch(() => null)
    const total = member?.ptTotal || 0
    const left = member?.ptRemaining ?? 0
    const deduct = deductOn && total > 0
    if (deduct && left <= 0) {
      // B4: 남은 PT가 없어도 수업은 했으면 '완료(미결제)'로 남기고 관리자가 결제 후 차감
      if (!(await confirm(`${nameOf(s)}님은 남은 PT가 없어요. '완료(미결제)'로 기록할까요? 차감 없이 남기고, 관리자가 결제 후 처리해요.`, { okLabel: '미결제로 완료', cancelLabel: '취소' }))) return
      return run(s, () => trainerCompleteSchedule(s, trainer, false, { unpaid: true }), `${s.date} ${s.time} PT 완료(미결제)`, '미결제로 완료했어요.')
    }
    if (!(await confirm(`${s.time} ${nameOf(s)}님 PT를 완료로 바꿀까요?${deduct ? ` 남은 횟수 ${left}회 → ${left - 1}회` : ''}`, { okLabel: '완료', cancelLabel: '취소' }))) return
    run(s, () => trainerCompleteSchedule(s, trainer, deduct), `${s.date} ${s.time} PT 완료${deduct ? `(차감 ${left}→${left - 1})` : ''}`, '완료했어요.')
  }
  async function noshow(s) {
    const policy = settings.noshowPolicy || 'off'
    let deduct = false
    let left = 0
    if (policy === 'deduct' && settings.ptDeductEnabled) {
      const m = await getUserDoc(s.memberUid).catch(() => null)
      left = m?.ptRemaining ?? 0
      deduct = (m?.ptTotal || 0) > 0 && left > 0
    }
    if (!(await confirm(`${s.time} ${nameOf(s)}님 PT를 노쇼로 처리할까요?${deduct ? ` 노쇼도 1회 차감돼요(${left}회 → ${left - 1}회).` : ' 남은 횟수는 그대로예요.'}`, { okLabel: '노쇼 처리', cancelLabel: '취소' }))) return
    run(s, () => trainerNoShowSchedule(s, trainer, deduct), `${s.date} ${s.time} 노쇼${deduct ? `(차감 ${left}→${left - 1})` : ''}`, '노쇼로 처리했어요.')
  }
  async function nextWeek(s) {
    const d = addDays(s.date, 7)
    try {
      const same = (await listTrainerSchedulesByDates(uid, [d])).filter((x) => x.time === s.time && x.status !== 'noshow')
      if (same.length) {
        await confirm(`${fmtDay(d)} ${s.time}에 이미 일정이 있어요(${same.map(nameOf).join(', ')}).`, { okLabel: '확인', cancelLabel: '닫기' })
        return
      }
    } catch (err) {
      console.error('다음 주 일정 확인 실패:', err) // 확인을 못 해도 예약은 막지 않는다
    }
    if (!(await confirm(`${nameOf(s)}님 다음 주 ${fmtDay(d)} ${s.time}에 PT를 잡을까요? 회원 HOME에 알려요.`, { okLabel: '예약', cancelLabel: '취소' }))) return
    run(s, () => trainerAddSchedule(s.memberUid, trainer, d, s.time, { memberName: nameOf(s) }), `${d} ${s.time} PT 일정 등록(다음 주 같은 시간)`, `${fmtDay(d)} ${s.time}에 잡았어요.`)
  }
  const btn = { fontSize: 13, fontWeight: 700, padding: '6px 2px' }
  return (
    <Card style={{ marginBottom: 20 }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>오늘 PT <span className="bt-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-label-neutral)' }}>{items.length}건</span></p>
      {items.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--color-line)', marginTop: 8, flexWrap: 'wrap' }}>
          <span className="bt-num" style={{ minWidth: 44, fontSize: 14, fontWeight: 800 }}>{s.time}</span>
          <span className="text-keep-all" style={{ flex: 1, minWidth: 80, fontSize: 14, fontWeight: 600 }}>
            {nameOf(s)}
            {s.status !== 'scheduled' && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--color-label-neutral)' }}>{s.status === 'done' ? '완료' : '노쇼'}</span>}
          </span>
          <span style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            {s.status === 'scheduled' && (
              <>
                <button type="button" disabled={busy === s.id} onClick={() => complete(s)} style={{ ...btn, color: 'var(--color-primary-strong)' }}>완료</button>
                {(settings.noshowPolicy || 'off') !== 'off' && <button type="button" disabled={busy === s.id} onClick={() => noshow(s)} style={{ ...btn, color: 'var(--color-warning)' }}>노쇼</button>}
              </>
            )}
            <button type="button" disabled={busy === s.id} onClick={() => nextWeek(s)} style={{ ...btn, color: 'var(--color-label-normal)' }}>다음 주 같은 시간</button>
          </span>
        </div>
      ))}
      {msg && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{msg}</p>}
    </Card>
  )
}
