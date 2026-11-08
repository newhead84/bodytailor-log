// TraineesScreen.jsx
// [2026-10-31 신규, Phase2 P2-2] 트레이너 "내 회원": 담당(활성 연결) 회원 목록 → 회원별 최근 8주 운동 기록(읽기 전용).
// 기록 읽기는 firestore.rules isTrainerOf(활성 연결 + 트레이너 역할)가 허용한다.
// [2026-10-31] PT 회원의 신체정보(성별·나이·키·몸무게)·운동 목표·주당 목표 일수도 트레이너에게 보여준다(users 문서 읽기 허용).
// [2026-10-31 P2-3] 회원 화면 상단 "운동 계획": 트레이너가 회원의 루틴(계획)을 만들어 보내고 수정·삭제한다(RoutineSetup forTrainer 재사용).
// [2026-11-01] 처리 안 된 지난 일정(A20), 회원 목록에 다음 PT(이미 읽은 7일 일정, 추가 읽기 없음, A19 일부), 같은 시간 중복 예약 경고(A17),
//  회원권 만료·휴회 표시와 만료 회원 일정 경고(A18), 미래 일정 완료 확인(A21), 일정 없이 완료 날짜 선택(A22), 계획 변경 이력(A33)
// [2026-11-03] 태블릿(768px 이상): 회원은 둥근 정사각형 타일, PT 일정은 월 캘린더, 회원 기록은 수기 운동일지처럼 종목별 날짜 비교 표(날짜별 보기 전환)
// [2026-11-01] 2차: 목록에 남은 PT·마지막 운동(A19, 회원 문서 한 번 읽고 10분 보관), 주간 일정표 ‹ › 이동(B21), 트레이너 메모(B19),
//  일정 시간 바꾸기·회원 알림(B20), 남은 PT 0회 '완료(미결제)'(B4), 일정·기록에 회원 이름 저장(B26), 새 일정 기본 시간 = 그 회원 마지막 일정 시간(B18)
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ScreenHeader, Button, Card, useConfirm } from './ui'
import RoutineSetup from './RoutineSetup'
import TrainerPlanBadge from './TrainerPlanBadge'
import { TrainerGoalEditor } from './TrainerGoal'
import { useBackableScreen } from '../hooks/useBackableScreen'
import { getUserDoc, getAppSettings, listPtSessions, trainerUsePt, trainerUndoPt, listPtSchedules, trainerAddSchedule, trainerDeleteSchedule, trainerMoveSchedule, trainerCompleteSchedule, trainerReopenSchedule, trainerNoShowSchedule, trainerListOverdueSchedules, logAction, listMyTrainees, listTrainerSchedulesByDates, getWorkoutLogsInRange, getRoutineTemplates, saveTrainerPlan, deleteRoutineTemplate, MAX_TRAINER_PLANS, getTraineeSummaries, invalidateTraineeSummary, getTrainerNote, saveTrainerNote, getLatestFitnessTests } from '../storage'
import { fitnessDerived } from '../utils/fitnessCheck'
import { toLocalDateStr, weekStartStr } from '../utils/date'
import { membershipState, isPausedOn, pausesOf, addDays } from '../utils/member'
import { normalizeGoals } from '../utils/goals'
import { getExerciseInputType } from '../utils/exerciseLibrary'
import { formatLoad, repsUnit, logVolumeKg } from '../utils/load'
import { formatCardioSet } from '../utils/cardioFields'
import { setTypeMark, detectPlateaus, recentPrList, SET_TYPE_LABEL, bestE1rmOfSets, cleanTrainerRx, trainerRxText } from '../utils/strength'
import { exerciseKeyLabel, makeExerciseKey } from '../utils/exerciseKey'
import { ExerciseName } from '../utils/exerciseName'
import { bodyMetrics } from '../utils/bodyComp'

const DAY = ['일', '월', '화', '수', '목', '금', '토']
function fmtDay(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${m}/${d}(${DAY[dt.getDay()]})`
}
// [2026-11-02] 트레이너가 강도를 판단할 수 있게 웜업(W)뿐 아니라 드롭(D)·실패(F)와 RIR도 표시
function setsText(ex) {
  const type = getExerciseInputType(ex.name)
  const sets = ex.sets || []
  const mark = (s) => (setTypeMark(s) ? `${setTypeMark(s)} ` : '')
  const rir = (s) => (s.rir !== undefined && s.rir !== null && s.rir !== '' ? ` RIR${s.rir}` : '')
  if (type === 'cardio') return sets.map((s) => formatCardioSet(ex.name, s)).join(' / ')
  if (type === 'reps') return sets.map((s) => `${mark(s)}${s.reps}${repsUnit(ex.name)}${rir(s)}`).join(' / ')
  return sets.map((s) => `${mark(s)}${formatLoad(ex.name, s.weight)}×${s.reps}${rir(s)}`).join(' / ')
}
// 이 기록에 있는 세트 종류만 뜻을 한 줄로(W 웜업 · D 드롭 · F 실패)
function setTypeLegend(log) {
  const present = ['warmup', 'drop', 'failure'].filter((t) => (log.exercises || []).some((ex) => (ex.sets || []).some((st) => st?.type === t)))
  return present.map((t) => `${setTypeMark({ type: t })} ${SET_TYPE_LABEL[t]}`).join(' · ')
}

// [2026-11-02] 회원 화면 요약: 정체 종목(최근 3회 추정 1RM이 그 전보다 높지 않음)·최근 2주 신기록 - 이미 읽은 8주 기록·회원 문서만 사용
function MemberProgressCard({ logs, member, flushTop = false }) {
  const plateaus = useMemo(() => detectPlateaus([...(logs || [])].reverse()).slice(0, 3), [logs])
  const prs = useMemo(() => {
    const since = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 14)
      return toLocalDateStr(d)
    })()
    return recentPrList(member?.prs, 5).filter((p) => p.date >= since).slice(0, 3)
  }, [member?.prs])
  if (!logs || logs.length === 0) return null
  const row = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5 }
  return (
    <Card style={{ marginTop: flushTop ? 0 : 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>진행 요약</p>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-neutral)' }}>정체 종목 {plateaus.length}개</p>
      {plateaus.length === 0 ? (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-label-neutral)' }}>최근 3회 추정 1RM이 멈춘 종목이 없어요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {plateaus.map((p) => (
            <div key={p.key} style={row}>
              <span className="text-keep-all"><ExerciseName name={exerciseKeyLabel(p.key)} /></span>
              <span className="bt-num" style={{ color: 'var(--color-label-neutral)', flexShrink: 0 }}>{Math.round(p.bestBefore)} → {Math.round(p.bestRecent)}kg</span>
            </div>
          ))}
        </div>
      )}
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-neutral)' }}>최근 2주 신기록 {prs.length}개</p>
      {prs.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>최근 2주에 세운 신기록이 없어요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {prs.map((p) => (
            <div key={p.key} style={row}>
              <span className="text-keep-all"><ExerciseName name={exerciseKeyLabel(p.key)} /></span>
              <span className="bt-num" style={{ color: 'var(--color-label-neutral)', flexShrink: 0 }}>추정 1RM {Math.round(p.e1rm)}kg · {fmtDay(p.date)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// [2026-11-02] 트레이너는 태블릿을 자주 써서, 넓은 화면(768px 이상)에서는 두 칸으로 나눠 PT 일정·회원 정보와 기록을 함께 본다
const WIDE_QUERY = '(min-width: 768px)'
function useWide(query = WIDE_QUERY) {
  const [wide, setWide] = useState(() => {
    try {
      return window.matchMedia(query).matches
    } catch (e) {
      return false
    }
  })
  useEffect(() => {
    let mq
    try {
      mq = window.matchMedia(query)
    } catch (e) {
      return undefined
    }
    const on = () => setWide(mq.matches)
    on()
    if (mq.addEventListener) mq.addEventListener('change', on)
    else mq.addListener?.(on)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on)
      else mq.removeListener?.(on)
    }
  }, [query])
  return wide
}
const wideGrid = (left, right) => ({ display: 'grid', gridTemplateColumns: `minmax(0, ${left}fr) minmax(0, ${right}fr)`, gap: 20, alignItems: 'start', maxWidth: 1200, margin: '0 auto' })

export default function TraineesScreen({ uid, trainerName = '', customExercises = {}, onClose }) {
  const wide = useWide()
  // [2026-11-03] 세로 태블릿(768~1099px)은 월 캘린더가 좁아져 위(캘린더)·아래(회원 타일)로 쌓는다
  const wideTwoCol = useWide('(min-width: 1100px)')
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  const [weekItems, setWeekItems] = useState([]) // 이번 주 일정(회원 카드의 '다음 PT'에 재사용)
  const [sums, setSums] = useState({}) // [2026-11-01] A19: 회원별 남은 PT·마지막 운동
  useEffect(() => {
    if (!list || !list.length) return
    let alive = true
    getTraineeSummaries(list.map((c) => c.memberUid))
      .then((m) => alive && setSums(m))
      .catch((err) => console.error('회원 요약 불러오기 실패:', err))
    return () => {
      alive = false
    }
  }, [list, sel])
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

  if (sel) return <MemberLogs conn={sel} uid={uid} trainerName={trainerName || sel.trainerName} customExercises={customExercises} onBack={closeSel} wide={wide} />
  const schedules = list && list.length > 0 && (
    <>
      <OverdueSchedules uid={uid} list={list} onOpen={setSel} />
      {wide ? <MonthSchedules uid={uid} list={list} onOpen={setSel} onItems={setWeekItems} /> : <WeekSchedules uid={uid} list={list} onOpen={setSel} onItems={setWeekItems} />}
    </>
  )
  const members = list === null ? (
        <p style={{ color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : list.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>아직 연결된 회원이 없어요. 관리자에게 연결을 요청해 주세요.</p></Card>
      ) : (
        wide ? (
          <MemberTiles list={list} sums={sums} weekItems={weekItems} onOpen={setSel} />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((c) => (
            <Card key={c.id} onClick={() => setSel(c)}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{c.memberName}{c.memberNickname ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}> · {c.memberNickname}</span> : null}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
                {(() => {
                  const next = weekItems.find((s) => s.memberUid === c.memberUid && s.status === 'scheduled' && s.date >= toLocalDateStr(new Date()))
                  const m = sums[c.memberUid]
                  const parts = []
                  if (m && m.ptTotal > 0) parts.push(<span key="pt" style={{ color: m.ptRemaining <= 3 ? 'var(--color-warning)' : undefined }}>PT <span className="bt-num">{m.ptRemaining}/{m.ptTotal}</span>회</span>)
                  if (m) parts.push(<span key="last">마지막 운동 {m.lastDate ? <span className="bt-num">{fmtDay(m.lastDate)}</span> : '없음'}</span>)
                  if (next) parts.push(<span key="next">다음 PT <span className="bt-num">{fmtDay(next.date)} {next.time}</span></span>)
                  return parts.map((x, i) => <React.Fragment key={i}>{x} · </React.Fragment>)
                })()}
                계획 · 기록 보기 ›
              </p>
            </Card>
          ))}
        </div>
        )
      )
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: wide ? '0 28px 80px' : '0 20px 80px', boxSizing: 'border-box' }}>
      <ScreenHeader title="내 회원" onBack={onClose} bleed={wide ? 28 : 20} />
      <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px', ...(wide ? { maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto' } : {}) }}>관리자가 연결한 담당 회원이에요. 운동 계획을 만들어 보내고, 회원이 남긴 기록을 볼 수 있어요(기록 수정은 회원만).</p>
      {wide && !wideTwoCol ? (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {schedules}
          {members}
        </div>
      ) : wide && schedules ? (
        <div style={wideGrid(5, 6)}>
          <div>{schedules}</div>
          <div>{members}</div>
        </div>
      ) : (
        <>
          {schedules}
          {members}
        </>
      )}
    </div>
  )
}

// [2026-11-01] 처리 안 된 지난 일정(A20): 내 'scheduled' 일정 중 오늘 전 날짜(등호 조건 2개, 복합 색인 없이). 없으면 카드를 그리지 않는다.
function OverdueSchedules({ uid, list, onOpen }) {
  const [items, setItems] = useState(null)
  const today = toLocalDateStr(new Date())
  useEffect(() => {
    let alive = true
    trainerListOverdueSchedules(uid, today)
      .then((l) => alive && setItems(l))
      .catch((err) => {
        console.error('지난 일정 불러오기 실패:', err)
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
  }, [uid, today])
  const byMember = Object.fromEntries(list.map((c) => [c.memberUid, c]))
  const shown = (items || []).filter((s) => byMember[s.memberUid])
  if (!shown.length) return null
  return (
    <Card style={{ marginBottom: 14 }}>
      <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: 'var(--color-warning)' }}>처리 안 된 지난 일정 {shown.length}건</p>
      <p className="text-keep-all" style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>날짜가 지났는데 아직 예정이에요. 회원 화면에서 완료·노쇼·삭제로 정리해 주세요(정산에 빠질 수 있어요).</p>
      {shown.map((s) => (
        <button key={s.id} type="button" onClick={() => onOpen(byMember[s.memberUid])} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', borderTop: '1px solid var(--color-line)', textAlign: 'left', color: 'var(--color-label-strong)' }}>
          <span className="bt-num" style={{ minWidth: 92, fontSize: 14, fontWeight: 700 }}>{fmtDay(s.date)} {s.time}</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{byMember[s.memberUid].memberName}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-strong)' }}>정리 ›</span>
        </button>
      ))}
    </Card>
  )
}

// [2026-10-31] 오늘·이번 주 PT 일정 모아보기 - 줄을 누르면 그 회원 화면으로
// [2026-11-01] B21: 월~일 주간 일정표 + ‹ › 주 이동(한 주 = 날짜 7개 조회 1번). 다른 트레이너 일정은 규칙상 읽을 수 없어 내 일정만.
function WeekSchedules({ uid, list, onOpen, onItems }) {
  const [items, setItems] = useState(null)
  const [offset, setOffset] = useState(0)
  const today = toLocalDateStr(new Date())
  const monday = weekStartStr(today, offset)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const [day, setDay] = useState(today)
  useEffect(() => {
    let alive = true
    setItems(null)
    listTrainerSchedulesByDates(uid, dates)
      .then((l) => {
        if (!alive) return
        setItems(l)
        if (offset === 0) onItems?.(l)
      })
      .catch((err) => {
        console.error('PT 일정 모아보기 실패:', err)
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, monday])
  const byMember = Object.fromEntries(list.map((c) => [c.memberUid, c]))
  const shown = (items || []).filter((s) => byMember[s.memberUid])
  const dayItems = shown.filter((s) => s.date === day)
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
  const navBtn = { width: 36, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', fontSize: 16, color: 'var(--color-label-normal)' }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>PT 일정 <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>{fmtDay(dates[0])} ~ {fmtDay(dates[6])}</span></p>
        <button type="button" aria-label="이전 주" onClick={() => { setOffset((o) => o - 1); setDay(addDays(monday, -7)) }} style={navBtn}>‹</button>
        {offset !== 0 && <button type="button" onClick={() => { setOffset(0); setDay(today) }} style={{ ...navBtn, width: 'auto', padding: '0 8px', fontSize: 12.5, fontWeight: 700 }}>이번 주</button>}
        <button type="button" aria-label="다음 주" onClick={() => { setOffset((o) => o + 1); setDay(addDays(monday, 7)) }} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
        {dates.map((d, i) => {
          const list2 = shown.filter((s) => s.date === d)
          const on = d === day
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={on}
              aria-label={`${fmtDay(d)} PT ${list2.length}건`}
              style={{ minHeight: 64, padding: '4px 2px', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--color-fill-strong)' : 'var(--color-line)'}`, background: d === today ? 'var(--color-bg-elevated)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'var(--color-label-strong)', minWidth: 0 }}
            >
              <span style={{ fontSize: 11, color: i === 6 ? 'var(--color-danger)' : i === 5 ? 'var(--color-info, var(--color-label-neutral))' : 'var(--color-label-neutral)' }}>{DAY[(i + 1) % 7]}</span>
              <span className="bt-num" style={{ fontSize: 13, fontWeight: d === today ? 800 : 600 }}>{Number(d.slice(8))}</span>
              {list2.slice(0, 3).map((s) => (
                <span key={s.id} className="bt-num" style={{ fontSize: 10.5, lineHeight: 1.2, opacity: s.status === 'scheduled' ? 1 : 0.5, textDecoration: s.status === 'noshow' ? 'line-through' : 'none' }}>{s.time}</span>
              ))}
              {list2.length > 3 && <span style={{ fontSize: 10.5, color: 'var(--color-label-neutral)' }}>+{list2.length - 3}</span>}
            </button>
          )
        })}
      </div>
      {items === null ? (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : (
        <>
          <p style={{ margin: '12px 0 2px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{fmtDay(day)}{day === today ? ' 오늘' : ''} · {dayItems.length}건</p>
          {dayItems.length ? dayItems.map(row) : <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>이날 잡힌 PT가 없어요. 일정은 회원 화면의 PT 카드에서 잡아요.</p>}
        </>
      )}
    </Card>
  )
}

function MemberLogs({ conn, uid, trainerName, customExercises, onBack, wide = false }) {
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
  // [2026-11-07] 이 트레이너가 보낸 계획의 처방(종목키 → { rx, planIds }) - 기록 표에서 처방대로 했는지 비교
  const [myPlans, setMyPlans] = useState([])
  const rxIndex = useMemo(() => {
    const m = {}
    myPlans.forEach((t) => {
      Object.entries(cleanTrainerRx(t.trainerRx)).forEach(([k, rx]) => {
        if (!m[k]) m[k] = { rx, planIds: new Set() }
        m[k].planIds.add(t.id)
      })
    })
    return m
  }, [myPlans])
  const [recView, setRecView] = useState('ex') // [2026-11-03] 태블릿 기록 보기: 종목별(날짜 비교 표) | 날짜별

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
            logAction({ action: 'plan', targetUid: conn.memberUid, targetName: conn.memberName, detail: `운동 계획 ${editing === 'new' ? '새로 보냄' : '수정'}: ${String(data?.title || '').slice(0, 40)}` })
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

  // [2026-11-02] 태블릿(넓은 화면): 왼쪽 회원 정보·PT·메모·계획, 오른쪽 진행 요약·기록(기록은 펼친 채로 시작)
  const info = (
    <>
      <MemberBody member={member} memberUid={conn.memberUid} goalEditor={member ? <TrainerGoalEditor member={member} memberUid={conn.memberUid} memberName={conn.memberName} trainer={{ uid, name: trainerName }} onChanged={loadMember} /> : null} />
      <PtCard member={member} conn={conn} uid={uid} trainerName={trainerName} onChanged={() => { invalidateTraineeSummary(conn.memberUid); loadMember() }} />
      <TrainerNoteCard uid={uid} memberUid={conn.memberUid} />
      <MemberPlans key={plansKey} conn={conn} uid={uid} onNew={() => setEditing('new')} onEdit={(t) => setEditing(t)} onLoaded={setMyPlans} />
    </>
  )
  const records = (
    <>
      <MemberProgressCard logs={logs} member={member || null} flushTop={wide} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 10px' }}>
        <h2 style={{ fontSize: 16, margin: 0, flex: 1 }}>운동 기록</h2>
        {wide && logs && logs.length > 0 && (
          <div role="tablist" aria-label="기록 보기 방식" style={{ display: 'flex', gap: 4 }}>
            {[['ex', '종목별'], ['day', '날짜별']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={recView === k} onClick={() => setRecView(k)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, border: '1px solid var(--color-line)', background: recView === k ? 'var(--color-fill-strong)' : 'transparent', color: recView === k ? 'var(--color-on-fill)' : 'var(--color-label-normal)' }}>{label}</button>
            ))}
          </div>
        )}
      </div>
      {logs !== null && logs.length > 0 && wide && recView === 'ex' ? (
        <ExerciseLogTables logs={logs} rxIndex={rxIndex} />
      ) : logs === null ? (
        <p style={{ color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : logs.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>최근 8주 동안 기록이 없어요.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map((l) => {
            const key = l.id || l.date
            const isOpen = open[key] ?? wide
            const vol = Math.round(logVolumeKg(l))
            return (
              <Card key={key} onClick={() => setOpen((o) => ({ ...o, [key]: !(o[key] ?? wide) }))}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    {fmtDay(l.date)} {l.partName ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {l.partName}</span> : null}
                    {/* [2026-11-02] 3시간 방치로 자동 저장된 기록은 운동 시간이 실제와 다를 수 있어 표시 */}
                    {l.autoFinalized ? <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', color: 'var(--color-label-neutral)', verticalAlign: 'middle' }}>자동 저장</span> : null}
                  </p>
                  <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>
                    {l.durationMin ? <><span className="bt-num">{l.durationMin}</span>분 · </> : null}
                    {vol > 0 ? <><span className="bt-num">{vol.toLocaleString()}</span>kg</> : `${(l.exercises || []).length}종목`}
                  </span>
                </div>
                {isOpen ? (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(l.exercises || []).map((ex, i) => (
                      <div key={i}>
                        <p className="text-keep-all" style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}><ExerciseName name={ex.name} />{ex.grip ? ` (${ex.grip})` : ''}</p>
                        <p className="record-notation" style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-label-normal)', wordBreak: 'break-all' }}>{setsText(ex)}</p>
                      </div>
                    ))}
                    {setTypeLegend(l) && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-label-neutral)' }}>{setTypeLegend(l)}</p>}
                  </div>
                ) : (
                  <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{(l.exercises || []).map((e) => e.name).join(', ')}</p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: wide ? '0 28px 80px' : '0 20px 80px', boxSizing: 'border-box' }}>
      <ScreenHeader title={conn.memberName} onBack={onBack} backLabel="회원 목록" bleed={wide ? 28 : 20} />
      <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px', ...(wide ? { maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto' } : {}) }}>최근 8주 운동 기록 · 이번 주 <span className="bt-num">{thisWeekDays}</span>일 운동</p>
      {wide ? (
        <div style={wideGrid(5, 7)}>
          <div>{info}</div>
          <div>{records}</div>
        </div>
      ) : (
        <>
          {info}
          {records}
        </>
      )}
    </div>
  )
}

// [2026-11-03] 태블릿 회원 타일: 둥근 정사각형 격자(이름·남은 PT·이번 주 운동 일수·마지막 운동·다음 PT) - 이미 읽은 요약·일정만 사용
function MemberTiles({ list, sums, weekItems, onOpen }) {
  const today = toLocalDateStr(new Date())
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12 }}>
      {list.map((c) => {
        const m = sums[c.memberUid]
        const next = weekItems.find((s) => s.memberUid === c.memberUid && s.status === 'scheduled' && s.date >= today)
        const low = m && m.ptTotal > 0 && m.ptRemaining <= 3
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c)}
            aria-label={`${c.memberName} 회원 화면 열기`}
            style={{ aspectRatio: '1 / 1', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between', gap: 6, padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)', textAlign: 'left', color: 'var(--color-label-strong)' }}
          >
            <span style={{ minWidth: 0 }}>
              <span className="text-keep-all" style={{ display: 'block', fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>{c.memberName}</span>
              {c.memberNickname ? <span className="text-keep-all" style={{ display: 'block', fontSize: 12.5, color: 'var(--color-label-neutral)', marginTop: 2 }}>{c.memberNickname}</span> : null}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              {m && m.ptTotal > 0 ? (
                <span style={{ color: low ? 'var(--color-warning)' : 'var(--color-label-normal)' }}>
                  남은 PT <span className="bt-num" style={{ fontSize: 20, fontWeight: 800, color: low ? 'var(--color-warning)' : 'var(--color-label-strong)' }}>{m.ptRemaining}</span>
                  <span className="bt-num">/{m.ptTotal}</span>회
                </span>
              ) : (
                <span>PT 등록 없음</span>
              )}
              {m ? <span>이번 주 <span className="bt-num" style={{ fontWeight: 700, color: 'var(--color-label-strong)' }}>{m.weekDays || 0}</span>일 운동</span> : null}
              {m ? <span>마지막 {m.lastDate ? <span className="bt-num">{fmtDay(m.lastDate)}</span> : '운동 없음'}</span> : null}
              {next ? <span style={{ color: 'var(--color-primary-strong)', fontWeight: 700 }}>다음 PT <span className="bt-num">{fmtDay(next.date)} {next.time}</span></span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// [2026-11-03] 태블릿 PT 일정: 월 캘린더(월요일 시작). 날짜 칸에 건수·시간·회원 이름 2명까지, 누르면 아래에 그날 목록.
// 조회는 기존 날짜 목록 조회(in 10개씩)를 이번 달 날짜로 나눠 부른다 - 새 색인 없음, 읽기 = 그달 일정 수.
function MonthSchedules({ uid, list, onOpen, onItems }) {
  const today = toLocalDateStr(new Date())
  const [offset, setOffset] = useState(0)
  const [day, setDay] = useState(today)
  const [items, setItems] = useState(null)
  const base = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + offset, 1)
  const y = base.getFullYear()
  const mo = base.getMonth()
  const monthKey = `${y}-${String(mo + 1).padStart(2, '0')}`
  const lastDay = new Date(y, mo + 1, 0).getDate()
  const monthDates = Array.from({ length: lastDay }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`)
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7 // 월요일 시작
  useEffect(() => {
    let alive = true
    setItems(null)
    const chunks = []
    for (let i = 0; i < monthDates.length; i += 10) chunks.push(monthDates.slice(i, i + 10))
    Promise.all(chunks.map((c) => listTrainerSchedulesByDates(uid, c)))
      .then((parts) => {
        if (!alive) return
        const l = parts.flat().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        setItems(l)
        if (offset === 0) onItems?.(l)
      })
      .catch((err) => {
        console.error('PT 월 일정 불러오기 실패:', err)
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, monthKey])
  const byMember = Object.fromEntries(list.map((c) => [c.memberUid, c]))
  const shown = (items || []).filter((s) => byMember[s.memberUid])
  const dayItems = shown.filter((s) => s.date === day)
  const go = (n) => {
    setOffset((o) => o + n)
    const d = new Date(y, mo + n, 1)
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    setDay(first.slice(0, 7) === today.slice(0, 7) ? today : first)
  }
  const navBtn = { width: 36, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', fontSize: 16, color: 'var(--color-label-normal)' }
  const cells = [...Array.from({ length: lead }, () => null), ...monthDates]
  while (cells.length % 7) cells.push(null)
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>PT 일정 <span className="bt-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{y}년 {mo + 1}월</span> <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {shown.filter((s) => s.status !== 'noshow').length}건</span></p>
        <button type="button" aria-label="이전 달" onClick={() => go(-1)} style={navBtn}>‹</button>
        {offset !== 0 && <button type="button" onClick={() => go(-offset)} style={{ ...navBtn, width: 'auto', padding: '0 8px', fontSize: 12.5, fontWeight: 700 }}>이번 달</button>}
        <button type="button" aria-label="다음 달" onClick={() => go(1)} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
        {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
          <span key={d} style={{ textAlign: 'center', fontSize: 11.5, padding: '2px 0 4px', color: i === 6 ? 'var(--color-danger)' : i === 5 ? 'var(--color-info, var(--color-label-neutral))' : 'var(--color-label-neutral)' }}>{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const l = shown.filter((s) => s.date === d)
          const on = d === day
          const col = i % 7
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={on}
              aria-label={`${fmtDay(d)} PT ${l.length}건`}
              style={{ minHeight: 70, padding: '4px 3px', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--color-fill-strong)' : 'var(--color-line)'}`, background: d === today ? 'var(--color-bg-elevated)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, color: 'var(--color-label-strong)', minWidth: 0, overflow: 'hidden', textAlign: 'left' }}
            >
              <span className="bt-num" style={{ fontSize: 12.5, fontWeight: d === today ? 800 : 600, color: col === 6 ? 'var(--color-danger)' : col === 5 ? 'var(--color-info, var(--color-label-strong))' : undefined }}>{Number(d.slice(8))}</span>
              {l.slice(0, 2).map((s) => (
                <span key={s.id} style={{ display: 'block', fontSize: 11, lineHeight: 1.2, overflow: 'hidden', opacity: s.status === 'scheduled' ? 1 : 0.5, textDecoration: s.status === 'noshow' ? 'line-through' : 'none' }}>
                  <span className="bt-num" style={{ display: 'block', fontWeight: 700 }}>{s.time}</span>
                  <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}>{byMember[s.memberUid]?.memberName}</span>
                </span>
              ))}
              {l.length > 2 && <span style={{ fontSize: 10.5, color: 'var(--color-label-neutral)' }}>+{l.length - 2}건</span>}
            </button>
          )
        })}
      </div>
      {items === null ? (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : (
        <>
          <p style={{ margin: '12px 0 2px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{fmtDay(day)}{day === today ? ' 오늘' : ''} · {dayItems.length}건</p>
          {dayItems.length ? dayItems.map((s) => scheduleRow(s, byMember[s.memberUid], onOpen)) : <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>이날 잡힌 PT가 없어요. 일정은 회원 화면의 PT 카드에서 잡아요.</p>}
        </>
      )}
    </Card>
  )
}
function scheduleRow(s, c, onOpen) {
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

// [2026-11-03] 수기 운동일지처럼: 종목마다 표 1장, 칸 = 날짜(오래된 → 최근, 오른쪽 끝이 최근), 줄 = 세트.
// 처음에는 오른쪽 끝(최근)으로 스크롤해 둔다. 맨 아래 줄은 그날 최고 추정 1RM(무게 종목만, 늘면 ▲).
function setCell(name, type, st) {
  const mark = setTypeMark(st) ? `${setTypeMark(st)} ` : ''
  if (type === 'cardio') return formatCardioSet(name, st)
  if (type === 'reps') return `${mark}${st.reps}${repsUnit(name)}`
  return `${mark}${formatLoad(name, st.weight)}×${st.reps}${repsUnit(name) === '초' ? '초' : ''}`
}
// [2026-11-07] 처방대로 했는지: 그 계획으로 한 날만, 본세트 수 ≥ 처방 세트 + 처방 세트만큼 하한 이상
function rxCheck(rx, sets) {
  const work = (sets || []).filter((st) => st?.type !== 'warmup' && Number(st?.reps) > 0)
  const okSets = work.filter((st) => Number(st.reps) >= rx.repMin).length
  return work.length >= rx.sets && okSets >= rx.sets
}
function ExerciseLogTables({ logs, rxIndex = {} }) {
  const groups = useMemo(() => {
    const m = new Map()
    ;[...logs].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((l) => {
      ;(l.exercises || []).forEach((ex) => {
        if (!(ex.sets || []).length) return
        const key = makeExerciseKey(ex.name, ex.grip)
        if (!m.has(key)) m.set(key, { key, name: ex.name, grip: ex.grip, rows: [] })
        m.get(key).rows.push({ id: `${l.id || l.date}-${m.get(key).rows.length}`, date: l.date, sets: ex.sets, auto: !!l.autoFinalized, planId: l.routineTemplateId || null })
      })
    })
    return [...m.values()].sort((a, b) => (a.rows[a.rows.length - 1].date < b.rows[b.rows.length - 1].date ? 1 : a.rows[a.rows.length - 1].date > b.rows[b.rows.length - 1].date ? -1 : b.rows.length - a.rows.length))
  }, [logs])
  const hasRir = (st) => st && st.rir !== undefined && st.rir !== null && st.rir !== ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((g) => {
        const type = getExerciseInputType(g.name)
        // 웜업은 수기 일지처럼 맨 위 'W' 한 줄에 모으고, 본세트(드롭·실패 포함)만 1·2·3 번호 줄에 맞춘다
        const split = g.rows.map((r) => ({ warm: r.sets.filter((st) => st?.type === 'warmup'), work: r.sets.filter((st) => st?.type !== 'warmup') }))
        const hasWarm = split.some((x) => x.warm.length > 0)
        const maxSets = Math.max(0, ...split.map((x) => x.work.length))
        const e1 = type === 'sets' ? g.rows.map((r) => Math.round(bestE1rmOfSets(r.sets, g.name))) : null
        const showE1 = e1 && e1.some((v) => v > 0)
        const marks = new Set(g.rows.flatMap((r) => r.sets.map((st) => st?.type)).filter((t) => t === 'warmup' || t === 'drop' || t === 'failure'))
        const rxe = rxIndex[g.key] || rxIndex[g.name] || null
        return (
          <Card key={g.key} style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '14px 16px 10px' }}>
              <p className="text-keep-all" style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}><ExerciseName name={g.name} />{g.grip ? ` (${g.grip})` : ''}</p>
              <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}><span className="bt-num">{g.rows.length}</span>회 기록</span>
            </div>
            {rxe && (
              <p className="text-keep-all" style={{ margin: '-4px 16px 8px', fontSize: 12.5, color: 'var(--color-label-normal)' }}>
                내 처방 · {trainerRxText(rxe.rx, repsUnit(g.name))}
              </p>
            )}
            <ScrollEnd>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, ...stickyCol, textAlign: 'left' }}>세트</th>
                    {g.rows.map((r) => (
                      <th key={r.id} style={thStyle}>
                        <span className="bt-num">{fmtDay(r.date)}</span>
                        {r.auto ? <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>자동 저장</span> : null}
                        {rxe && r.planId && rxe.planIds.has(r.planId) ? (
                          rxCheck(rxe.rx, r.sets)
                            ? <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--color-primary-strong)' }}>처방대로</span>
                            : <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>처방보다 적게</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasWarm && (
                    <tr>
                      <td style={{ ...tdStyle, ...stickyCol, color: 'var(--color-label-neutral)', fontWeight: 700 }}>W</td>
                      {g.rows.map((r, ri) => (
                        <td key={r.id} style={{ ...tdStyle, color: 'var(--color-label-neutral)' }}>
                          {split[ri].warm.length ? split[ri].warm.map((st, k) => <span key={k} className="record-notation" style={{ display: 'block' }}>{setCell(g.name, type, { ...st, type: 'working' })}</span>) : <span style={{ color: 'var(--color-line)' }}>·</span>}
                        </td>
                      ))}
                    </tr>
                  )}
                  {Array.from({ length: maxSets }, (_, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, ...stickyCol, color: 'var(--color-label-neutral)', fontWeight: 700 }}>{i + 1}</td>
                      {g.rows.map((r, ri) => {
                        const st = split[ri].work[i]
                        return (
                          <td key={r.id} style={tdStyle}>
                            {st ? (
                              <>
                                <span className="record-notation" style={{ display: 'block', color: 'var(--color-label-strong)' }}>{setCell(g.name, type, st)}</span>
                                {hasRir(st) ? <span className="bt-num" style={{ display: 'block', fontSize: 10.5, color: 'var(--color-label-neutral)' }}>RIR {st.rir}</span> : null}
                              </>
                            ) : (
                              <span style={{ color: 'var(--color-line)' }}>·</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {showE1 && (
                    <tr>
                      <td style={{ ...tdStyle, ...stickyCol, fontSize: 11.5, color: 'var(--color-label-neutral)', fontWeight: 700, borderTop: '1px solid var(--color-line)' }}>추정 1RM</td>
                      {g.rows.map((r, i) => {
                        const up = i > 0 && e1[i] > 0 && e1[i] > Math.max(0, ...e1.slice(0, i))
                        return (
                          <td key={r.id} style={{ ...tdStyle, borderTop: '1px solid var(--color-line)', fontWeight: 700 }}>
                            {e1[i] > 0 ? <span className="bt-num" style={{ color: up ? 'var(--color-primary-strong)' : 'var(--color-label-normal)' }}>{up ? '▲ ' : ''}{e1[i]}kg</span> : <span style={{ color: 'var(--color-line)' }}>·</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollEnd>
            {marks.size > 0 && (
              <p style={{ margin: 0, padding: '8px 16px 12px', fontSize: 12, color: 'var(--color-label-neutral)' }}>{['warmup', 'drop', 'failure'].filter((t) => marks.has(t)).map((t) => `${setTypeMark({ type: t })} ${SET_TYPE_LABEL[t]}`).join(' · ')}</p>
            )}
            {marks.size === 0 && <div style={{ height: 8 }} />}
          </Card>
        )
      })}
    </div>
  )
}
const thStyle = { padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-normal)', whiteSpace: 'nowrap', textAlign: 'center', borderBottom: '1px solid var(--color-line)', background: 'var(--card-bg)' }
const tdStyle = { padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'center', minWidth: 84 }
const stickyCol = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-bg)', minWidth: 52, textAlign: 'left', paddingLeft: 16 }
// 가로 스크롤 영역을 처음에 오른쪽 끝(최근 날짜)으로
function ScrollEnd({ children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])
  return (
    <div ref={ref} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {children}
    </div>
  )
}

// [2026-10-31 P2-3] 트레이너가 보낸 계획(수정·삭제 가능) + 회원이 직접 만든 루틴(보기만)
function MemberPlans({ conn, uid, onNew, onEdit, onLoaded }) {
  const confirm = useConfirm()
  const [list, setList] = useState(null)
  const load = useCallback(() => {
    getRoutineTemplates(conn.memberUid)
      .then((l) => {
        setList(l)
        onLoaded?.((l || []).filter((t) => t.byTrainer?.uid === uid))
      })
      .catch((err) => {
        console.error('회원 루틴 불러오기 실패:', err)
        setList([])
      })
  }, [conn.memberUid, uid, onLoaded])
  useEffect(load, [load])
  if (list === null) return <p style={{ color: 'var(--color-label-neutral)', fontSize: 13 }}>계획 불러오는 중…</p>
  const mine = list.filter((t) => t.byTrainer?.uid === uid)
  const others = list.filter((t) => t.byTrainer?.uid !== uid)
  async function remove(t) {
    if (!(await confirm(`"${t.title}" 계획을 삭제할까요? 회원 화면에서도 사라져요.`))) return
    try {
      await deleteRoutineTemplate(conn.memberUid, t.id)
      logAction({ action: 'plan', targetUid: conn.memberUid, targetName: conn.memberName, detail: `운동 계획 삭제: ${String(t.title || '').slice(0, 40)}` })
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
            {(() => {
              const n = Object.keys(cleanTrainerRx(t.trainerRx)).length
              return n > 0 ? <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>처방 <span className="bt-num">{n}</span>종목 · 회원 화면에서 로그 코치보다 먼저 따라요</p> : null
            })()}
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
// [2026-10-31] goalEditor: 트레이너 목표 제안·바로 바꾸기(TrainerGoal.jsx)
function MemberBody({ member, memberUid, goalEditor }) {
  // [2026-11-07] 회원이 적은 체력 점검(최근 2개, 읽기 전용 - 신체 정보와 같은 공유 범위)
  const [tests, setTests] = useState(null)
  useEffect(() => {
    if (!memberUid) return
    let alive = true
    getLatestFitnessTests(memberUid, 2)
      .then((l) => alive && setTests(l))
      .catch(() => alive && setTests([]))
    return () => {
      alive = false
    }
  }, [memberUid])
  if (member === null) return null
  if (member === false) return <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>회원 신체정보를 불러오지 못했어요.</p>
  const o = member.onboarding || {}
  const body = [o.gender, o.age ? `${o.age}세` : '', o.heightCm ? `${o.heightCm}cm` : '', o.weightKg ? `${o.weightKg}kg` : ''].filter(Boolean)
  // [2026-11-08] 신체 지표: 허리/키 비율·체지방률(인바디)·골격근량·FFMI가 있으면 한 줄, BMI는 참고
  const bm = bodyMetrics(o)
  const metric = [
    bm.fat && `체지방 ${bm.fat.text}% ${bm.fat.band.verdict}`,
    bm.smm && `골격근 ${bm.smm}kg`,
    bm.ffmi && `FFMI ${bm.ffmi.text}`,
    bm.whtr && `허리 ${o.waistCm}cm(허리/키 ${bm.whtr.text})`,
    bm.bmi && `BMI ${bm.bmi.text}`,
  ].filter(Boolean)
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
        {metric.length > 0 && row('신체 지표', `${metric.join(' · ')}${bm.fat && bm.inbodyAt ? ` (인바디 ${bm.inbodyAt})` : ''}`)}
        {row('운동 목표', goals.length ? goals.map((g, i) => `${i + 1}. ${g}`).join('  ') : '입력 안 함')}
        {row('주간 목표', `주 ${member.weeklyTargetDays || 3}일`)}
        {tests?.length > 0 &&
          row(
            '체력 점검',
            `${tests[0].date} · ${fitnessDerived(tests[0], Number(o.weightKg) || 0)
              .map((r) => `${r.label} ${r.text}`)
              .join(' · ')}${tests[1] ? ` (이전 ${tests[1].date})` : ''}`
          )}
      </div>
      {goalEditor}
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
  const [timeTouched, setTimeTouched] = useState(false) // [2026-11-01] B18: 직접 고르기 전에는 이 회원의 마지막 일정 시간
  const [moving, setMoving] = useState(null) // [2026-11-01] B20: 시간 바꾸는 일정 { id, date, time }
  const [useDate, setUseDate] = useState(today) // [2026-11-01] 일정 없이 1회 완료 날짜(A22)
  const trainer = { uid, name: trainerName }
  const withName = (s) => ({ ...s, memberName: s.memberName || conn.memberName || '' })
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
  useEffect(() => {
    if (timeTouched || !schedules.length) return
    const last = schedules[schedules.length - 1]?.time
    if (last && /^\d{2}:\d{2}$/.test(last)) setNewTime(last)
  }, [schedules, timeTouched])
  if (!member) return null
  // [2026-11-01] 회원권 상태(A18): 만료·D-day·휴회 표시, 만료 회원 일정·완료 때 확인
  const ms = membershipState(member, today)
  const paused = isPausedOn(member, today)
  const curPause = paused ? pausesOf(member).find((p) => p.start <= today && today <= p.end) : null
  const expired = ms.kind === 'expired'
  const expiredOk = async (what) => !expired || confirm(`회원권이 ${String(ms.end).replace(/-/g, '.')}에 끝난 회원이에요. 그래도 ${what}할까요? 재등록 여부는 관리자에게 확인해 주세요.`, { okLabel: what, cancelLabel: '취소' })
  const total = typeof member.ptTotal === 'number' ? member.ptTotal : 0
  const left = member.ptRemaining ?? 0
  const deduct = enabled && total > 0
  const upcoming = schedules.filter((s) => s.status === 'scheduled')
  const doneNoSession = schedules.filter((s) => (s.status === 'done' || s.status === 'noshow') && !sessions.some((x) => x.scheduleId === s.id)).slice(-3).reverse()
  const noshowDeduct = noshowPolicy === 'deduct' && deduct
  // [2026-10-31] 트레이너 PT 작업도 관리 이력에 남긴다(정산·확인용)
  const ptLog = (detail) => logAction({ action: 'pt', targetUid: conn.memberUid, targetName: conn.memberName, detail })
  async function run(fn, failMsg, logDetail) {
    setBusy(true)
    try {
      await fn()
      if (logDetail) await ptLog(logDetail)
      onChanged()
      reload()
    } catch (err) {
      console.error(failMsg, err)
      await confirm(`${failMsg}. 연결 상태${deduct ? '와 남은 횟수' : ''}를 확인해 주세요.`, { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy(false)
    }
  }
  // [2026-11-01] B4: 남은 PT가 없으면 '완료(미결제)'로 차감 없이 남기고 관리자가 결제 후 차감 처리
  const askUnpaid = () => confirm(`${conn.memberName}님은 남은 PT가 없어요. '완료(미결제)'로 기록할까요? 차감 없이 남기고, 관리자가 결제 후 처리해요.`, { okLabel: '미결제로 완료', cancelLabel: '취소' })
  async function use() {
    const d = useDate && useDate <= today ? useDate : today
    if (!(await expiredOk('기록'))) return
    if (left <= 0) {
      if (!(await askUnpaid())) return
      return run(() => trainerUsePt(conn.memberUid, trainer, d, { memberName: conn.memberName, unpaid: true }), '기록하지 못했어요', `${d} 일정 없이 PT 1회 완료(미결제)`)
    }
    if (!(await confirm(`${conn.memberName}님 ${fmtDay(d)} PT 1회를 완료로 기록할까요? 남은 횟수가 ${left}회 → ${left - 1}회가 돼요.`, { okLabel: '1회 완료', cancelLabel: '취소' }))) return
    run(() => trainerUsePt(conn.memberUid, trainer, d, { memberName: conn.memberName }), '기록하지 못했어요', `${d} 일정 없이 PT 1회 완료(차감 ${left}→${left - 1})`)
  }
  async function complete(s) {
    if (deduct && left <= 0) {
      if (s.date > today) return confirm('아직 날짜가 안 된 일정이에요. 남은 PT가 없어 미리 완료할 수 없어요.', { okLabel: '확인', cancelLabel: '닫기' })
      if (!(await expiredOk('완료'))) return
      if (!(await askUnpaid())) return
      return run(() => trainerCompleteSchedule(withName(s), trainer, false, { unpaid: true }), '완료 처리하지 못했어요', `${s.date} ${s.time} PT 완료(미결제)`)
    }
    // [2026-11-01] 아직 오지 않은 날짜의 일정을 미리 완료하면 정산 달이 어긋날 수 있어 한 번 더 확인(A21)
    if (s.date > today && !(await confirm(`${fmtDay(s.date)} 일정은 아직 날짜가 안 됐어요. 수업을 앞당겨 했을 때만 완료해 주세요(완료 날짜는 일정 날짜로 남아요). 계속할까요?`, { okLabel: '계속', cancelLabel: '취소' }))) return
    if (!(await expiredOk('완료'))) return
    if (!(await confirm(`${fmtDay(s.date)} ${s.time} PT를 완료로 바꿀까요?${deduct ? ` 남은 횟수가 ${left}회 → ${left - 1}회가 돼요.` : ''}`, { okLabel: '완료', cancelLabel: '취소' }))) return
    run(() => trainerCompleteSchedule(withName(s), trainer, deduct), '완료 처리하지 못했어요', `${s.date} ${s.time} PT 완료${deduct ? `(차감 ${left}→${left - 1})` : ''}`)
  }
  async function noshow(s) {
    if (s.date > today) return confirm('아직 날짜가 안 된 일정은 노쇼로 처리할 수 없어요.', { okLabel: '확인', cancelLabel: '닫기' })
    if (noshowDeduct && left <= 0) return confirm('남은 PT 횟수가 없어요. 관리자에게 횟수 등록을 요청해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    if (!(await confirm(`${fmtDay(s.date)} ${s.time} PT를 노쇼로 처리할까요?${noshowDeduct ? ` 노쇼도 1회 차감돼 남은 횟수가 ${left}회 → ${left - 1}회가 돼요.` : ' 남은 횟수는 그대로예요.'}`, { okLabel: '노쇼 처리', cancelLabel: '취소' }))) return
    run(() => trainerNoShowSchedule(withName(s), trainer, noshowDeduct), '노쇼 처리하지 못했어요', `${s.date} ${s.time} 노쇼${noshowDeduct ? `(차감 ${left}→${left - 1})` : ''}`)
  }
  // [2026-11-01] 일정 추가: 만료 회원 확인(A18) + 같은 날 내 일정 중 1시간 안에 겹치는 것 경고(A17, 그날 내 일정 1번 조회)
  async function addSchedule() {
    const date = newDate
    const time = newTime.slice(0, 5)
    if (!(await expiredOk('일정 추가'))) return
    try {
      const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
      const same = (await listTrainerSchedulesByDates(uid, [date])).filter((x) => x.status !== 'noshow' && Math.abs(mins(x.time) - mins(time)) < 60)
      if (same.length && !(await confirm(`${fmtDay(date)} ${same.map((x) => x.time).join(', ')}에 이미 PT가 있어요(1시간 안). 그래도 ${time}에 추가할까요?`, { okLabel: '추가', cancelLabel: '취소' }))) return
    } catch (err) {
      console.error('중복 일정 확인 실패:', err) // 확인을 못 해도 추가는 막지 않는다
    }
    run(() => trainerAddSchedule(conn.memberUid, trainer, date, time, { memberName: conn.memberName }), '일정을 등록하지 못했어요', `${date} ${time} PT 일정 등록`)
  }
  async function remove(s) {
    if (!(await confirm(`${fmtDay(s.date)} ${s.time} PT 일정을 삭제할까요? 회원 캘린더에서도 사라지고 회원 HOME에 취소 알림이 보여요.`, { okLabel: '삭제', cancelLabel: '취소' }))) return
    run(() => trainerDeleteSchedule(s.id, s), '삭제하지 못했어요', `${s.date} ${s.time} PT 일정 삭제`)
  }
  // [2026-11-01] B20: 시간 바꾸기(같은 일정의 날짜·시간만) → 회원 HOME에 '일정 변경' 알림
  async function saveMove() {
    const s = upcoming.find((x) => x.id === moving?.id)
    if (!s || !moving.date || !moving.time) return
    const time = moving.time.slice(0, 5)
    if (moving.date === s.date && time === s.time) return setMoving(null)
    try {
      const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
      const same = (await listTrainerSchedulesByDates(uid, [moving.date])).filter((x) => x.id !== s.id && x.status !== 'noshow' && Math.abs(mins(x.time) - mins(time)) < 60)
      if (same.length && !(await confirm(`${fmtDay(moving.date)} ${same.map((x) => x.time).join(', ')}에 이미 PT가 있어요(1시간 안). 그래도 바꿀까요?`, { okLabel: '바꾸기', cancelLabel: '취소' }))) return
    } catch (err) {
      console.error('중복 일정 확인 실패:', err)
    }
    await run(() => trainerMoveSchedule(s, moving.date, time), '시간을 바꾸지 못했어요', `${s.date} ${s.time} → ${moving.date} ${time} PT 일정 변경`)
    setMoving(null)
  }
  async function undo(s) {
    if (!(await confirm(`${fmtDay(s.date)} PT 완료를 되돌릴까요?${s.unpaid ? ' 미결제 기록이라 남은 횟수는 그대로예요.' : ' 남은 횟수가 1회 늘어요.'}`, { okLabel: '되돌리기', cancelLabel: '취소' }))) return
    run(() => trainerUndoPt(conn.memberUid, s), '되돌리지 못했어요', `${s.date} ${s.noshow ? '노쇼' : 'PT 완료'}${s.unpaid ? '(미결제)' : ''} 되돌리기${s.unpaid ? '' : '(남은 횟수 +1)'}`)
  }
  const field = { padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14, fontFamily: 'inherit', minWidth: 0 }
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13.5, padding: '7px 0', borderTop: '1px solid var(--color-line)' }
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>PT</p>
          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>
            {total > 0 ? <><span className="bt-num">{left}</span>회 남음 <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}>/ 총 <span className="bt-num">{total}</span>회</span></> : '등록된 횟수 없음'}
          </p>
        </div>
        {deduct && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
            <input type="date" value={useDate} max={today} onChange={(e) => setUseDate(e.target.value)} aria-label="PT 한 날짜" style={{ ...field, padding: '7px 8px', fontSize: 13, minWidth: 0, maxWidth: '100%' }} />
            <Button variant="ghost" disabled={busy} onClick={use} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>일정 없이 1회 완료</Button>
          </div>
        )}
      </div>
      {(expired || ms.kind === 'soon' || paused) && (
        <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 700, color: expired ? 'var(--color-danger)' : 'var(--color-warning)' }}>
          {expired ? `회원권 만료(${String(ms.end).replace(/-/g, '.')})` : ms.kind === 'soon' ? `회원권 D-${ms.daysLeft} (${String(ms.end).replace(/-/g, '.')}까지)` : ''}
          {paused ? `${expired || ms.kind === 'soon' ? ' · ' : ''}휴회 중(${String(curPause.end).replace(/-/g, '.')}까지)` : ''}
        </p>
      )}
      {!enabled && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>PT 횟수 차감은 관리자가 대시보드에서 켜면 쓸 수 있어요(일정 등록·완료 표시는 지금도 돼요).</p>}

      <p style={{ margin: '16px 0 6px', fontSize: 14, fontWeight: 700 }}>PT 일정 <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· 회원 홈 캘린더에 보여요</span></p>
      {upcoming.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-label-neutral)' }}>예정된 일정이 없어요.</p>}
      {upcoming.map((s) => (
        <div key={s.id} style={{ ...rowStyle, flexWrap: 'wrap' }}>
          <span>
            {fmtDay(s.date)} <b>{s.time}</b>
            {s.date < today ? <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--color-warning)' }}>완료 처리 안 됨</span> : null}
          </span>
          <span style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button type="button" disabled={busy} onClick={() => complete(s)} style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-strong)' }}>완료</button>
            {noshowPolicy !== 'off' && <button type="button" disabled={busy} onClick={() => noshow(s)} style={{ fontSize: 13, color: 'var(--color-warning)' }}>노쇼</button>}
            <button type="button" disabled={busy} onClick={() => setMoving(moving?.id === s.id ? null : { id: s.id, date: s.date < today ? today : s.date, time: s.time })} style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>시간 바꾸기</button>
            <button type="button" disabled={busy} onClick={() => remove(s)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>삭제</button>
          </span>
          {moving?.id === s.id && (
            <div style={{ display: 'flex', gap: 6, width: '100%', flexWrap: 'wrap', paddingTop: 4 }}>
              <input type="date" value={moving.date} min={today} onChange={(e) => setMoving((m) => ({ ...m, date: e.target.value }))} aria-label="바꿀 날짜" style={{ ...field, flex: '1 1 140px' }} />
              <input type="time" value={moving.time} step="600" onChange={(e) => setMoving((m) => ({ ...m, time: e.target.value }))} aria-label="바꿀 시간" style={{ ...field, flex: '1 1 100px' }} />
              <Button disabled={busy || !moving.date || !moving.time} onClick={saveMove} style={{ flex: '0 0 auto' }}>바꾸기</Button>
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <input type="date" value={newDate} min={today} onChange={(e) => setNewDate(e.target.value)} aria-label="PT 날짜" style={{ ...field, flex: '1 1 140px' }} />
        <input type="time" value={newTime} step="600" onChange={(e) => { setNewTime(e.target.value); setTimeTouched(true) }} aria-label="PT 시간" style={{ ...field, flex: '1 1 100px' }} />
        <Button disabled={busy || !newDate || !newTime} onClick={addSchedule} style={{ flex: '0 0 auto' }}>일정 추가</Button>
      </div>

      {(sessions.length > 0 || doneNoSession.length > 0) && (
        <>
          <p style={{ margin: '16px 0 6px', fontSize: 14, fontWeight: 700 }}>최근 완료</p>
          {sessions.slice(0, 5).map((s, i) => (
            <div key={s.id} style={rowStyle}>
              <span>{fmtDay(s.date)} {s.noshow ? '노쇼(1회 차감)' : `PT 완료${s.scheduleId ? '' : ' (일정 없이)'}`}{s.unpaid ? <b style={{ marginLeft: 6, fontSize: 12, color: 'var(--color-warning)' }}>미결제</b> : null}</span>
              {i === 0 && (enabled || s.unpaid) ? <button type="button" disabled={busy} onClick={() => undo(s)} style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>되돌리기</button> : null}
            </div>
          ))}
          {doneNoSession.map((s) => (
            <div key={s.id} style={rowStyle}>
              <span>{fmtDay(s.date)} {s.time} {s.status === 'noshow' ? '노쇼' : 'PT 완료'}</span>
              <button type="button" disabled={busy} onClick={() => run(() => trainerReopenSchedule(s.id), '되돌리지 못했어요', `${s.date} ${s.time} ${s.status === 'noshow' ? '노쇼' : '완료'} 되돌리기`)} style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>되돌리기</button>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}

// [2026-11-01] B19: 트레이너 회원별 메모(trainerNotes/{트레이너uid_회원uid}) - 이 트레이너와 관리자만 봐요(회원은 못 봐요)
function TrainerNoteCard({ uid, memberUid }) {
  const [note, setNote] = useState(null) // null = 불러오는 중
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let alive = true
    getTrainerNote(uid, memberUid)
      .then((n) => {
        if (!alive) return
        setNote(n || {})
        setText(n?.text || '')
      })
      .catch((err) => {
        console.error('트레이너 메모 불러오기 실패:', err)
        if (alive) setNote({ error: true })
      })
    return () => {
      alive = false
    }
  }, [uid, memberUid])
  if (note === null) return null
  async function save() {
    setSaving(true)
    setMsg('')
    try {
      await saveTrainerNote(uid, memberUid, text)
      setNote({ text })
      setMsg('저장했어요.')
    } catch (err) {
      console.error('트레이너 메모 저장 실패:', err)
      setMsg('저장하지 못했어요. 연결 상태를 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>트레이너 메모 <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· 나와 관리자만 봐요</span></p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="수업 메모(선호 시간, 다음 수업 계획 등)"
        aria-label="트레이너 메모"
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }}
      />
      <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-warning)' }}>부상·질병 같은 건강 정보는 민감정보라 적지 마세요.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <Button variant="secondary" disabled={saving || text === (note.text || '')} onClick={save}>메모 저장</Button>
        <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{msg || `${text.length}/1000`}</span>
      </div>
    </Card>
  )
}
