// TraineesScreen.jsx
// [2026-10-31 신규, Phase2 P2-2] 트레이너 "내 회원": 담당(활성 연결) 회원 목록 → 회원별 최근 8주 운동 기록(읽기 전용).
// 기록 읽기는 firestore.rules isTrainerOf(활성 연결 + 트레이너 역할)가 허용한다.
// [2026-10-31] PT 회원의 신체정보(성별·나이·키·몸무게)·운동 목표·주당 목표 일수도 트레이너에게 보여준다(users 문서 읽기 허용).
// [2026-10-31 P2-3] 회원 화면 상단 "운동 계획": 트레이너가 회원의 루틴(계획)을 만들어 보내고 수정·삭제한다(RoutineSetup forTrainer 재사용).
import React, { useCallback, useEffect, useState } from 'react'
import { BackButton, Button, Card, useConfirm } from './ui'
import RoutineSetup from './RoutineSetup'
import TrainerPlanBadge from './TrainerPlanBadge'
import { useBackableScreen } from '../hooks/useBackableScreen'
import { getUserDoc, getAppSettings, listPtSessions, trainerUsePt, trainerUndoPt, listPtSchedules, trainerAddSchedule, trainerDeleteSchedule, trainerCompleteSchedule, trainerReopenSchedule, trainerNoShowSchedule, listMyTrainees, listTrainerSchedulesByDates, getWorkoutLogsInRange, getRoutineTemplates, saveTrainerPlan, deleteRoutineTemplate, MAX_TRAINER_PLANS } from '../storage'
import { toLocalDateStr } from '../utils/date'
import { normalizeGoals } from '../utils/goals'
import { getExerciseInputType } from '../utils/exerciseLibrary'
import { formatLoad, repsUnit, logVolumeKg } from '../utils/load'
import { formatCardioSet } from '../utils/cardioFields'

const DAY = ['일', '월', '화', '수', '목', '금', '토']
function fmtDay(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${m}/${d}(${DAY[dt.getDay()]})`
}
function setsText(ex) {
  const type = getExerciseInputType(ex.name)
  const sets = ex.sets || []
  if (type === 'cardio') return sets.map((s) => formatCardioSet(ex.name, s)).join(' / ')
  if (type === 'reps') return sets.map((s) => `${s.type === 'warmup' ? 'W ' : ''}${s.reps}${repsUnit(ex.name)}`).join(' / ')
  return sets.map((s) => `${s.type === 'warmup' ? 'W ' : ''}${formatLoad(ex.name, s.weight)}×${s.reps}`).join(' / ')
}

export default function TraineesScreen({ uid, trainerName = '', customExercises = {}, onClose }) {
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  // 회원 상세에서 기기 뒤로가기 → 회원 목록으로(내 회원 화면 전체가 닫히지 않게)
  const closeSel = useCallback(() => setSel(null), [])
  useBackableScreen(!!sel, closeSel)
  useEffect(() => {
    listMyTrainees(uid)
      .then((l) => setList(l.sort((a, b) => String(a.memberName).localeCompare(String(b.memberName), 'ko'))))
      .catch((err) => {
        console.error('담당 회원 불러오기 실패:', err)
        setList([])
      })
  }, [uid])

  if (sel) return <MemberLogs conn={sel} uid={uid} trainerName={trainerName || sel.trainerName} customExercises={customExercises} onBack={closeSel} />
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 80px', boxSizing: 'border-box' }}>
      <BackButton onClick={onClose}>돌아가기</BackButton>
      <h1 style={{ fontSize: 24, margin: '8px 0 6px' }}>내 회원</h1>
      <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>관리자가 연결한 담당 회원이에요. 운동 계획을 만들어 보내고, 회원이 남긴 기록을 볼 수 있어요(기록 수정은 회원만).</p>
      {list && list.length > 0 && <WeekSchedules uid={uid} list={list} onOpen={setSel} />}
      {list === null ? (
        <p style={{ color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : list.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>아직 연결된 회원이 없어요. 관리자에게 연결을 요청해 주세요.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((c) => (
            <Card key={c.id} onClick={() => setSel(c)}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{c.memberName}{c.memberNickname ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}> · {c.memberNickname}</span> : null}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>계획 · 기록 보기 ›</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// [2026-10-31] 오늘·이번 주(오늘부터 7일) PT 일정 모아보기 - 줄을 누르면 그 회원 화면으로
function WeekSchedules({ uid, list, onOpen }) {
  const [items, setItems] = useState(null)
  const today = toLocalDateStr(new Date())
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return toLocalDateStr(d)
  })
  useEffect(() => {
    let alive = true
    listTrainerSchedulesByDates(uid, dates)
      .then((l) => alive && setItems(l))
      .catch((err) => {
        console.error('PT 일정 모아보기 실패:', err)
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, today])
  const byMember = Object.fromEntries(list.map((c) => [c.memberUid, c]))
  const shown = (items || []).filter((s) => byMember[s.memberUid])
  const todayItems = shown.filter((s) => s.date === today)
  const laterItems = shown.filter((s) => s.date !== today)
  const row = (s) => {
    const c = byMember[s.memberUid]
    const done = s.status === 'done'
    const ns = s.status === 'noshow'
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onOpen(c)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', borderTop: '1px solid var(--color-line)', textAlign: 'left', color: 'var(--color-label-strong)' }}
      >
        <span className="bt-num" style={{ minWidth: 44, fontSize: 14, fontWeight: 700 }}>{s.time}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.memberName}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: done ? 'var(--color-label-neutral)' : 'var(--color-primary-strong)' }}>{ns ? '노쇼' : done ? '완료' : '예정'} ›</span>
      </button>
    )
  }
  return (
    <Card style={{ marginBottom: 14 }}>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>PT 일정</p>
      {items === null ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : (
        <>
          <p style={{ margin: '8px 0 2px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>오늘 {fmtDay(today)} · {todayItems.length}건</p>
          {todayItems.length ? todayItems.map(row) : <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>오늘 잡힌 PT가 없어요.</p>}
          <p style={{ margin: '12px 0 2px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>이번 주(7일) · {laterItems.length}건</p>
          {laterItems.length ? (
            laterItems.map((s, i) => (
              <React.Fragment key={s.id}>
                {(i === 0 || laterItems[i - 1].date !== s.date) && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>{fmtDay(s.date)}</p>}
                {row(s)}
              </React.Fragment>
            ))
          ) : (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>남은 일정이 없어요. 일정은 회원 화면의 PT 카드에서 잡아요.</p>
          )}
        </>
      )}
    </Card>
  )
}

function MemberLogs({ conn, uid, trainerName, customExercises, onBack }) {
  const [logs, setLogs] = useState(null)
  const [open, setOpen] = useState({})
  const [editing, setEditing] = useState(null) // null | 'new' | template
  const [member, setMember] = useState(null) // users 문서(신체정보) - 못 읽으면 false
  const loadMember = useCallback(() => {
    getUserDoc(conn.memberUid)
      .then((d) => setMember(d || false))
      .catch((err) => {
        console.error('회원 정보 불러오기 실패:', err)
        setMember(false)
      })
  }, [conn.memberUid])
  useEffect(loadMember, [loadMember])
  useEffect(() => {
    const to = toLocalDateStr(new Date())
    const f = new Date()
    f.setDate(f.getDate() - 56)
    getWorkoutLogsInRange(conn.memberUid, toLocalDateStr(f), to)
      .then((l) => setLogs([...l].sort((a, b) => (a.date < b.date ? 1 : -1))))
      .catch((err) => {
        console.error('회원 기록 불러오기 실패:', err)
        setLogs([])
      })
  }, [conn.memberUid])
  const weekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return toLocalDateStr(d)
  })()
  const thisWeekDays = logs ? new Set(logs.filter((l) => l.date >= weekStart).map((l) => l.date)).size : 0
  const closeEditing = useCallback(() => setEditing(null), [])
  useBackableScreen(!!editing, closeEditing)
  const [plansKey, setPlansKey] = useState(0)

  if (editing) {
    return (
      <RoutineSetup
        initialTemplate={editing === 'new' ? null : editing}
        customExercises={customExercises}
        forTrainer={{ memberName: conn.memberName }}
        onCancel={closeEditing}
        onSave={async (data) => {
          try {
            await saveTrainerPlan(conn.memberUid, { uid, name: trainerName }, data)
            setEditing(null)
            setPlansKey((k) => k + 1)
          } catch (e) {
            console.error('계획 저장 실패:', e)
            window.alert(e?.message?.startsWith('한 회원') ? e.message : e?.code === 'not-found' ? '회원이 이 계획을 삭제했어요. 새 계획으로 만들어 주세요.' : '계획을 저장하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.')
            if (e?.code === 'not-found') { setEditing(null); setPlansKey((k) => k + 1) }
          }
        }}
      />
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 80px', boxSizing: 'border-box' }}>
      <BackButton onClick={onBack}>회원 목록</BackButton>
      <h1 style={{ fontSize: 24, margin: '8px 0 4px' }}>{conn.memberName}</h1>
      <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>최근 8주 운동 기록 · 이번 주 <span className="bt-num">{thisWeekDays}</span>일 운동</p>
      <MemberBody member={member} />
      <PtCard member={member} conn={conn} uid={uid} trainerName={trainerName} onChanged={loadMember} />
      <MemberPlans key={plansKey} conn={conn} uid={uid} onNew={() => setEditing('new')} onEdit={(t) => setEditing(t)} />
      <h2 style={{ fontSize: 16, margin: '22px 0 10px' }}>운동 기록</h2>
      {logs === null ? (
        <p style={{ color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : logs.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>최근 8주 동안 기록이 없어요.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map((l) => {
            const key = l.id || l.date
            const isOpen = !!open[key]
            const vol = Math.round(logVolumeKg(l))
            return (
              <Card key={key} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{fmtDay(l.date)} {l.partName ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {l.partName}</span> : null}</p>
                  <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>
                    {l.durationMin ? <><span className="bt-num">{l.durationMin}</span>분 · </> : null}
                    {vol > 0 ? <><span className="bt-num">{vol.toLocaleString()}</span>kg</> : `${(l.exercises || []).length}종목`}
                  </span>
                </div>
                {isOpen ? (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(l.exercises || []).map((ex, i) => (
                      <div key={i}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{ex.grip ? `${ex.name} (${ex.grip})` : ex.name}</p>
                        <p className="record-notation" style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-label-normal)', wordBreak: 'break-all' }}>{setsText(ex)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{(l.exercises || []).map((e) => e.name).join(', ')}</p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// [2026-10-31 P2-3] 트레이너가 보낸 계획(수정·삭제 가능) + 회원이 직접 만든 루틴(보기만)
function MemberPlans({ conn, uid, onNew, onEdit }) {
  const confirm = useConfirm()
  const [list, setList] = useState(null)
  const load = useCallback(() => {
    getRoutineTemplates(conn.memberUid)
      .then(setList)
      .catch((err) => {
        console.error('회원 루틴 불러오기 실패:', err)
        setList([])
      })
  }, [conn.memberUid])
  useEffect(load, [load])
  if (list === null) return <p style={{ color: 'var(--color-label-neutral)', fontSize: 13 }}>계획 불러오는 중…</p>
  const mine = list.filter((t) => t.byTrainer?.uid === uid)
  const others = list.filter((t) => t.byTrainer?.uid !== uid)
  async function remove(t) {
    if (!(await confirm(`"${t.title}" 계획을 삭제할까요? 회원 화면에서도 사라져요.`))) return
    try {
      await deleteRoutineTemplate(conn.memberUid, t.id)
      load()
    } catch (e) {
      console.error('계획 삭제 실패:', e)
      window.alert('계획을 삭제하지 못했어요.')
    }
  }
  const partsLine = (t) => (t.parts || []).map((p) => `${p.name}(${(p.exercises || []).length})`).join(' · ')
  return (
    <>
      <h2 style={{ fontSize: 16, margin: '4px 0 10px' }}>운동 계획</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mine.map((t) => (
          <Card key={t.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t.title}</p>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={() => onEdit(t)} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-primary-strong)' }}>수정</button>
                <button onClick={() => remove(t)} style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>삭제</button>
              </div>
            </div>
            <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-normal)' }}>{partsLine(t)}</p>
            {t.note && <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'pre-wrap' }}>{t.note}</p>}
          </Card>
        ))}
        {mine.length < MAX_TRAINER_PLANS ? (
          <Button full variant="secondary" onClick={onNew}>+ 새 계획 만들기</Button>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>계획은 회원당 {MAX_TRAINER_PLANS}개까지예요. 기존 계획을 수정하거나 삭제해 주세요.</p>
        )}
        {others.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>회원이 쓰는 다른 루틴(보기만)</p>
            {others.map((t) => (
              <p key={t.id} className="text-keep-all" style={{ margin: '0 0 4px', fontSize: 13 }}>
                <b>{t.title}</b>{t.byTrainer && <TrainerPlanBadge t={t} />} <span style={{ color: 'var(--color-label-neutral)' }}>· {partsLine(t)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// [2026-10-31] 회원 신체정보·목표 - 온보딩/MY 프로필 값 그대로
function MemberBody({ member }) {
  if (member === null) return null
  if (member === false) return <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>회원 신체정보를 불러오지 못했어요.</p>
  const o = member.onboarding || {}
  const body = [o.gender, o.age ? `${o.age}세` : '', o.heightCm ? `${o.heightCm}cm` : '', o.weightKg ? `${o.weightKg}kg` : ''].filter(Boolean)
  const goals = normalizeGoals(o.goals)
  const row = (k, v) => (
    <div style={{ display: 'flex', gap: 12, fontSize: 13.5, lineHeight: 1.5 }}>
      <span style={{ flexShrink: 0, width: 64, color: 'var(--color-label-neutral)' }}>{k}</span>
      <span className="text-keep-all" style={{ fontWeight: 600 }}>{v}</span>
    </div>
  )
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {row('신체정보', body.length ? body.join(' · ') : '입력 안 함')}
        {row('운동 목표', goals.length ? goals.map((g, i) => `${i + 1}. ${g}`).join('  ') : '입력 안 함')}
        {row('주간 목표', `주 ${member.weeklyTargetDays || 3}일`)}
      </div>
    </Card>
  )
}

// [2026-10-31] PT 남은 횟수 + PT 일정(등록·완료·삭제, 회원 홈 캘린더에 표시) + 차감(대시보드 설정에서 켠 경우만)
function PtCard({ member, conn, uid, trainerName, onChanged }) {
  const confirm = useConfirm()
  const [enabled, setEnabled] = useState(false)
  const [noshowPolicy, setNoshowPolicy] = useState('off') // [2026-10-31] 관리자 설정: off | mark | deduct
  const [sessions, setSessions] = useState([])
  const [schedules, setSchedules] = useState([])
  const [busy, setBusy] = useState(false)
  const today = toLocalDateStr(new Date())
  const [newDate, setNewDate] = useState(today)
  const [newTime, setNewTime] = useState('19:00')
  const trainer = { uid, name: trainerName }
  const reload = useCallback(() => {
    listPtSessions({ memberUid: conn.memberUid, trainerUid: uid }).then(setSessions).catch((err) => console.error('PT 기록 불러오기 실패:', err))
    listPtSchedules({ memberUid: conn.memberUid, trainerUid: uid }).then(setSchedules).catch((err) => console.error('PT 일정 불러오기 실패:', err))
  }, [conn.memberUid, uid])
  useEffect(() => {
    getAppSettings()
      .then((s) => {
        setEnabled(!!s?.ptDeductEnabled)
        setNoshowPolicy(s?.noshowPolicy || 'off')
      })
      .catch(() => {})
    reload()
  }, [reload])
  if (!member) return null
  const total = typeof member.ptTotal === 'number' ? member.ptTotal : 0
  const left = member.ptRemaining ?? 0
  const deduct = enabled && total > 0
  const upcoming = schedules.filter((s) => s.status === 'scheduled')
  const doneNoSession = schedules.filter((s) => (s.status === 'done' || s.status === 'noshow') && !sessions.some((x) => x.scheduleId === s.id)).slice(-3).reverse()
  const noshowDeduct = noshowPolicy === 'deduct' && deduct
  async function run(fn, failMsg) {
    setBusy(true)
    try {
      await fn()
      onChanged()
      reload()
    } catch (err) {
      console.error(failMsg, err)
      await confirm(`${failMsg}. 연결 상태${deduct ? '와 남은 횟수' : ''}를 확인해 주세요.`, { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy(false)
    }
  }
  async function use() {
    if (!(await confirm(`${conn.memberName}님 PT 1회를 완료로 기록할까요? 남은 횟수가 ${left}회 → ${left - 1}회가 돼요.`, { okLabel: '1회 완료', cancelLabel: '취소' }))) return
    run(() => trainerUsePt(conn.memberUid, trainer, today), '기록하지 못했어요')
  }
  async function complete(s) {
    if (deduct && left <= 0) return confirm('남은 PT 횟수가 없어요. 관리자에게 횟수 등록을 요청해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    if (!(await confirm(`${fmtDay(s.date)} ${s.time} PT를 완료로 바꿀까요?${deduct ? ` 남은 횟수가 ${left}회 → ${left - 1}회가 돼요.` : ''}`, { okLabel: '완료', cancelLabel: '취소' }))) return
    run(() => trainerCompleteSchedule(s, trainer, deduct), '완료 처리하지 못했어요')
  }
  async function noshow(s) {
    if (noshowDeduct && left <= 0) return confirm('남은 PT 횟수가 없어요. 관리자에게 횟수 등록을 요청해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    if (!(await confirm(`${fmtDay(s.date)} ${s.time} PT를 노쇼로 처리할까요?${noshowDeduct ? ` 노쇼도 1회 차감돼 남은 횟수가 ${left}회 → ${left - 1}회가 돼요.` : ' 남은 횟수는 그대로예요.'}`, { okLabel: '노쇼 처리', cancelLabel: '취소' }))) return
    run(() => trainerNoShowSchedule(s, trainer, noshowDeduct), '노쇼 처리하지 못했어요')
  }
  async function remove(s) {
    if (!(await confirm(`${fmtDay(s.date)} ${s.time} PT 일정을 삭제할까요? 회원 캘린더에서도 사라져요.`, { okLabel: '삭제', cancelLabel: '취소' }))) return
    run(() => trainerDeleteSchedule(s.id), '삭제하지 못했어요')
  }
  async function undo(s) {
    if (!(await confirm(`${fmtDay(s.date)} PT 완료를 되돌릴까요? 남은 횟수가 1회 늘어요.`, { okLabel: '되돌리기', cancelLabel: '취소' }))) return
    run(() => trainerUndoPt(conn.memberUid, s), '되돌리지 못했어요')
  }
  const field = { padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14, fontFamily: 'inherit', minWidth: 0 }
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13.5, padding: '7px 0', borderTop: '1px solid var(--color-line)' }
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>PT</p>
          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>
            {total > 0 ? <><span className="bt-num">{left}</span>회 남음 <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}>/ 총 <span className="bt-num">{total}</span>회</span></> : '등록된 횟수 없음'}
          </p>
        </div>
        {deduct && (
          <Button variant="ghost" disabled={busy || left <= 0} onClick={use} style={{ flexShrink: 0, fontSize: 13 }}>일정 없이 1회 완료</Button>
        )}
      </div>
      {!enabled && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>PT 횟수 차감은 관리자가 대시보드에서 켜면 쓸 수 있어요(일정 등록·완료 표시는 지금도 돼요).</p>}

      <p style={{ margin: '16px 0 6px', fontSize: 14, fontWeight: 700 }}>PT 일정 <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· 회원 홈 캘린더에 보여요</span></p>
      {upcoming.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-label-neutral)' }}>예정된 일정이 없어요.</p>}
      {upcoming.map((s) => (
        <div key={s.id} style={rowStyle}>
          <span>
            {fmtDay(s.date)} <b>{s.time}</b>
            {s.date < today ? <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--color-warning)' }}>완료 처리 안 됨</span> : null}
          </span>
          <span style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button type="button" disabled={busy} onClick={() => complete(s)} style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-strong)' }}>완료</button>
            {noshowPolicy !== 'off' && <button type="button" disabled={busy} onClick={() => noshow(s)} style={{ fontSize: 13, color: 'var(--color-warning)' }}>노쇼</button>}
            <button type="button" disabled={busy} onClick={() => remove(s)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>삭제</button>
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <input type="date" value={newDate} min={today} onChange={(e) => setNewDate(e.target.value)} aria-label="PT 날짜" style={{ ...field, flex: '1 1 140px' }} />
        <input type="time" value={newTime} step="600" onChange={(e) => setNewTime(e.target.value)} aria-label="PT 시간" style={{ ...field, flex: '1 1 100px' }} />
        <Button disabled={busy || !newDate || !newTime} onClick={() => run(() => trainerAddSchedule(conn.memberUid, trainer, newDate, newTime.slice(0, 5)), '일정을 등록하지 못했어요')} style={{ flex: '0 0 auto' }}>일정 추가</Button>
      </div>

      {(sessions.length > 0 || doneNoSession.length > 0) && (
        <>
          <p style={{ margin: '16px 0 6px', fontSize: 14, fontWeight: 700 }}>최근 완료</p>
          {sessions.slice(0, 5).map((s, i) => (
            <div key={s.id} style={rowStyle}>
              <span>{fmtDay(s.date)} {s.noshow ? '노쇼(1회 차감)' : `PT 완료${s.scheduleId ? '' : ' (일정 없이)'}`}</span>
              {i === 0 && enabled ? <button type="button" disabled={busy} onClick={() => undo(s)} style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>되돌리기</button> : null}
            </div>
          ))}
          {doneNoSession.map((s) => (
            <div key={s.id} style={rowStyle}>
              <span>{fmtDay(s.date)} {s.time} {s.status === 'noshow' ? '노쇼' : 'PT 완료'}</span>
              <button type="button" disabled={busy} onClick={() => run(() => trainerReopenSchedule(s.id), '되돌리지 못했어요')} style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>되돌리기</button>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}
