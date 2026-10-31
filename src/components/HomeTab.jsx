import React, { useEffect, useMemo, useState } from 'react'
import { Dumbbell, Moon, ClipboardCheck } from 'lucide-react'
import { Card, Button, useConfirm } from './ui'
import MembershipNotice from './MembershipNotice'
import { getRecentWorkoutLogs, getWorkoutLogsInRange, listPtSchedules, listPtSessions } from '../storage'
import { MuscleSetsCard, PrCard, startOfWeekStr } from './InsightCards'
import { suggestNextSet, workingSetsOf } from '../utils/strength'
import { isAssistedExercise, isBodyweightLoaded, logVolumeKg } from '../utils/load'
import { cardioStats } from '../utils/cardioFields'
import { getTrainingProfile } from '../utils/goals'
import { makeExerciseKey, parseExerciseKey } from '../utils/exerciseKey'
import { CountUp } from '../hooks/useCountUp'
import CalendarView from './CalendarView'
import { getExerciseDisplayAtom } from '../utils/exerciseLibrary'

// [2026-10-29] 'YYYY-MM-DD' → '10/26(월)' (HOME 최근 기록 표기)
function formatShortDate(ds) {
  if (!ds || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return ds || ''
  const d = new Date(ds + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`
}
import { getSuggestedNext } from '../utils/routineSuggestion'
import { pickRandomQuote } from '../utils/quotes'
import { todayStr, toLocalDateStr } from '../utils/date'

// 로그 하나에서 실제로 수행한 부위들을 중복 없이 뽑아 "가슴·삼두"처럼 요약한다.
function summarizePartsOfLog(log) {
  if (!log?.exercises?.length) return ''
  const atoms = [...new Set(log.exercises.map((ex) => getExerciseDisplayAtom(ex.name)).filter(Boolean))]
  return atoms.join('·')
}

export default function HomeTab({
  liveExercises = null,
  uid,
  userDoc,
  routineTemplates,
  logsVersion,
  workoutPhase,
  onGoToLog,
  onCancelWorkout,
  onLogsChanged,
  autoNotice,
  onDismissAutoNotice,
  onUndoAutoNotice,
}) {
  const confirm = useConfirm()
  const [undoing, setUndoing] = useState(false)
  async function handleUndoAutoNotice() {
    if (!(await confirm('자동 저장된 이 운동 기록을 삭제할까요?', { okLabel: '삭제', cancelLabel: '유지' }))) return
    setUndoing(true)
    try {
      await onUndoAutoNotice?.()
    } finally {
      setUndoing(false)
    }
  }
  // [2026-07-30 신규] 기록탭에서 웜업/본운동이 시작되면("오늘 운동 기록하러 가기" 또는
  // "한 세트 더?"를 통해 진입한 경우 모두 포함) 홈탭 카드가 "운동중" 상태로 바뀐다.
  const isWorkoutInProgress = workoutPhase === 'warmup' || workoutPhase === 'main'
  const [recentLogs, setRecentLogs] = useState([])
  const [showExtraCta, setShowExtraCta] = useState(false)
  const [showAllIncrease, setShowAllIncrease] = useState(false) // [2026-10-31] 증량 추천 "외 N" 펼치기
  const [monthSummary, setMonthSummary] = useState(null)
  // [2026-10-31] PT 일정(트레이너 등록) + 일정 없이 완료한 PT → 캘린더 표시, "다음 PT"
  const [ptItems, setPtItems] = useState([])
  // [2026-10-31] 관리자도 PT를 받을 수 있어 트레이너만 제외
  const isStaff = userDoc?.role === '트레이너'
  useEffect(() => {
    if (!uid || isStaff) return
    let alive = true
    Promise.all([listPtSchedules({ memberUid: uid }).catch(() => []), listPtSessions({ memberUid: uid }).catch(() => [])]).then(([sch, ses]) => {
      if (!alive) return
      const items = sch.map((s) => ({ date: s.date, time: s.time, done: s.status === 'done', trainerName: s.trainerName }))
      ses.filter((x) => !x.scheduleId).forEach((x) => items.push({ date: x.date, time: '', done: true, trainerName: x.trainerName }))
      setPtItems(items)
    })
    return () => {
      alive = false
    }
  }, [uid, isStaff, logsVersion])
  const ptByDate = useMemo(() => {
    const m = {}
    ptItems.forEach((it) => (m[it.date] = m[it.date] || []).push(it))
    Object.values(m).forEach((l) => l.sort((a, b) => String(a.time).localeCompare(String(b.time))))
    return m
  }, [ptItems])
  const nextPt = useMemo(() => {
    const now = new Date()
    const nowKey = `${toLocalDateStr(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return ptItems.filter((it) => !it.done && `${it.date} ${it.time || '23:59'}` >= nowKey).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null
  }, [ptItems])
  // [신규] "오늘 날짜"를 state로 들고 있어야, 자정을 넘긴 뒤 새 기록 없이 앱이 계속 켜져 있어도
  // (또는 백그라운드에 있다가 다음날 포그라운드로 복귀해도) doneToday가 재계산된다. 기존에는
  // useMemo가 recentLogs에만 의존해서, 날짜만 바뀌고 기록 배열 자체는 그대로면 어제의
  // "오늘도 득근!" 완료 상태가 그대로 남아있었다.
  const [today, setToday] = useState(() => todayStr())
  // [2026-07-29 신규] 앱 진입(마운트) 시마다 응원/습관/자기계발 문구 중 하나를 랜덤으로 뽑는다.
  // (직전 노출 문구와는 연달아 겹치지 않도록 utils/quotes.js에서 처리)
  const [quote] = useState(() => pickRandomQuote())
  // [2026-10-28 리디자인] 상단 날짜 오버라인(로컬 기준) 예: 10월 28일 수요일
  const [todayLabel] = useState(() => {
    const d = new Date()
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const logs = await getRecentWorkoutLogs(uid, 10)
      if (cancelled) return
      setRecentLogs(logs)
      setToday(todayStr())
    }
    load()
    return () => {
      cancelled = true
    }
    // logsVersion: 운동 완료 직후(App.jsx) 값이 올라가며 재조회를 트리거한다(재진입 없이 즉시 반영).
  }, [uid, logsVersion])

  // [신규] 탭이 백그라운드에 있다가 다시 보이거나(visibilitychange) 창이 포커스를 되찾을 때도
  // 날짜를 다시 확인한다(모바일 PWA에서 자정을 넘긴 채 탭이 살아있는 경우를 대비).
  useEffect(() => {
    function refreshToday() {
      setToday(todayStr())
    }
    document.addEventListener('visibilitychange', refreshToday)
    window.addEventListener('focus', refreshToday)
    return () => {
      document.removeEventListener('visibilitychange', refreshToday)
      window.removeEventListener('focus', refreshToday)
    }
  }, [])

  // [2026-10-27 리뉴얼 W2] 이번 주 기록(주간 요약·근육별 세트)
  const [weekLogs, setWeekLogs] = useState([])
  useEffect(() => {
    let cancelled = false
    getWorkoutLogsInRange(uid, startOfWeekStr(), today)
      .then((logs) => !cancelled && setWeekLogs(logs))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uid, logsVersion, today])
  // [2026-10-29] 운동 중이면 오늘 체크한 세트도 이번 주 요약에 더한다(근육별 세트와 같은 기준)
  const liveLog = useMemo(() => (Array.isArray(liveExercises) && liveExercises.length > 0 ? { date: toLocalDateStr(new Date()), exercises: liveExercises } : null), [liveExercises])
  const weekWithLive = useMemo(() => (liveLog ? [...weekLogs, liveLog] : weekLogs), [weekLogs, liveLog])
  const cardioWeek = useMemo(() => cardioStats(weekWithLive), [weekWithLive])
  const weekStats = useMemo(() => {
    const sessions = new Set(weekWithLive.map((l) => l.date)).size
    let sets = 0
    weekWithLive.forEach((l) => (l.exercises || []).forEach((e) => (sets += workingSetsOf(e).length)))
    const volume = weekWithLive.reduce((v, l) => v + logVolumeKg(l), 0)
    return { sessions, sets, volume }
  }, [weekWithLive])

  const todayLogs = useMemo(() => recentLogs.filter((l) => l.date === today), [recentLogs, today])
  const doneToday = todayLogs.length > 0
  const suggested = useMemo(() => getSuggestedNext(routineTemplates, recentLogs), [routineTemplates, recentLogs])
  // 오늘 차례 파트의 종목 중 이중 진행 기준 "증량 추천" 종목
  const increaseList = useMemo(() => {
    if (!suggested?.part?.exercises) return []
    const out = []
    suggested.part.exercises.forEach((key) => {
      const { name, grip } = parseExerciseKey(key)
      const log = recentLogs.find((l) => (l.exercises || []).some((e) => makeExerciseKey(e.name, e.grip) === makeExerciseKey(name, grip)))
      const ex = log?.exercises.find((e) => makeExerciseKey(e.name, e.grip) === makeExerciseKey(name, grip))
      const sug = ex ? suggestNextSet(name, ex, userDoc?.exerciseSettings?.[key]) : null
      if (sug?.kind === 'increase') out.push({ key, name, weight: sug.weight })
    })
    return out
  }, [suggested, recentLogs, userDoc?.exerciseSettings])

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      {/* [2026-10-28 리디자인] 날짜 오버라인 + 큰 인사말 + 문구(1줄). 카드 없이 타이포 위계로 구성 */}
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-label-neutral)', margin: '0 0 6px' }}>
        {todayLabel}
      </p>
      <p className="text-keep-all" style={{ fontSize: 22, lineHeight: 1.3, fontWeight: 'var(--heading-weight)', letterSpacing: 'var(--heading-tracking)', color: 'var(--color-label-strong)', margin: '0 0 4px' }}>
        {userDoc?.nickname || '회원'}님, 안녕하세요
      </p>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-label-neutral)',
          margin: '0 0 20px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {quote}
      </p>

      {/* [2026-10-27 신규] "오늘 운동 완료"를 누르지 않고 방치된 세션을 자동 저장했을 때의 안내 */}
      {autoNotice && (
        <Card className="bt-slide-down" style={{ marginBottom: 16, border: '1px solid var(--color-line-strong)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <ClipboardCheck size={20} strokeWidth={1.8} style={{ color: 'var(--color-primary-normal)', flexShrink: 0, marginTop: 1 }} />
            <div className="text-keep-all" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                완료하지 않은 운동을 자동으로 저장했어요
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
                {autoNotice.date} · {autoNotice.exerciseCount}종목
                {autoNotice.totalVolume > 0 ? ` · ${Number(autoNotice.totalVolume).toLocaleString()}kg` : ''}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                체크(V)한 세트만 저장됐어요. 아래 캘린더에서 수정할 수 있어요.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button full style={{ flex: 1 }} onClick={onDismissAutoNotice}>
              확인
            </Button>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={undoing} onClick={handleUndoAutoNotice}>
              {undoing ? '삭제 중…' : '되돌리기'}
            </Button>
          </div>
        </Card>
      )}

      {/* [2026-10-31] 회원권 종료 임박(D-7)·만료 안내 */}
      <MembershipNotice userDoc={userDoc} />

      {/* [2026-10-28 리디자인] "오늘" 블록 — 카드 대신 큰 헤드라인(오늘 차례) + 보조 정보 + 버튼 */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)', margin: '0 0 4px' }}>오늘</p>
        <p className="text-keep-all" style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-label-strong)', margin: '0 0 4px' }}>
          {doneToday ? '오늘 운동을 마쳤어요' : suggested ? `${suggested.template.title} · ${suggested.part.name} 차례` : recentLogs[0] ? '오늘 운동을 시작해 볼까요?' : '첫 세트를 시작해 볼까요?'}
        </p>
        <p className="text-keep-all" style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
          {recentLogs[0]
            ? `최근 기록 ${formatShortDate(recentLogs[0].date)}${summarizePartsOfLog(recentLogs[0]) ? ` · ${summarizePartsOfLog(recentLogs[0])}` : ''}`
            : '아직 기록이 없어요.'}
        </p>
        {suggested && !doneToday && increaseList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: '-4px 0 14px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-normal)' }}>증량 추천</span>
            {increaseList.slice(0, showAllIncrease ? increaseList.length : 3).map((x) => (
              <span key={x.key} className="text-keep-all" style={{ fontSize: 12, padding: '4px 9px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', color: 'var(--color-label-normal)' }}>
                {x.name} {isAssistedExercise(x.name) ? '보조 ' : isBodyweightLoaded(x.name) ? '+' : ''}<span className="bt-num">{x.weight}</span>kg
              </span>
            ))}
            {increaseList.length > 3 && (
              <button
                type="button"
                aria-expanded={showAllIncrease}
                onClick={() => setShowAllIncrease((v) => !v)}
                style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px', color: 'var(--color-label-neutral)', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                {showAllIncrease ? '접기' : `외 ${increaseList.length - 3}개 보기`}
              </button>
            )}
          </div>
        )}

        {isWorkoutInProgress ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button full style={{ flex: 1 }} onClick={onGoToLog}>
              운동중 · 이어서 하기
            </Button>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={onCancelWorkout}>
              취소
            </Button>
          </div>
        ) : !doneToday || showExtraCta ? (
          <Button full onClick={onGoToLog}>
            오늘 운동 기록하러 가기
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button full disabled style={{ flex: 1 }}>
              오늘도 득근! 수고하셨습니다!
            </Button>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowExtraCta(true)}>
              한 세트 더?
            </Button>
          </div>
        )}
      </section>

      {/* [2026-10-27 리뉴얼 W2] 이번 주 요약 + 근육별 세트(상위 5) + 최근 PR */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderTop: '1px solid var(--color-line)',
          borderBottom: '1px solid var(--color-line)',
          padding: '14px 0',
          marginBottom: 20,
        }}
      >
        {[
          { v: weekStats.sessions, unit: '회', label: '이번 주 운동', d: 0 },
          { v: weekStats.sets, unit: '세트', label: '본세트', d: 0 },
          // [2026-10-28] 1,000kg 이상도 t 대신 kg(쉼표) 그대로 — 큰 숫자 카운트업이 보이도록
          { v: Math.round(weekStats.volume), unit: 'kg', label: '총 볼륨', d: 0 },
        ].map((it, i) => (
          <div key={it.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: i ? 14 : 2, borderLeft: i ? '1px solid var(--color-line)' : 'none' }}>
            {/* [2026-10-28] 320px 화면에서 52,000kg가 칸을 넘던 문제 → 화면 폭에 비례해 상한(min)까지만 */}
            <span className="bt-num" style={{ fontSize: `calc(min(${it.v >= 10000 ? 22 : 26}px, ${it.v >= 10000 ? 5 : 6.6}vw) * var(--num-scale))`, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              <CountUp value={it.v} decimals={it.d} />
              <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginLeft: 2 }}>{it.unit}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{it.label}</span>
          </div>
        ))}
      </div>
      {/* [2026-10-29] 유산소 기록 개선: 이번 주 유산소 시간·거리 한 줄 */}
      {cardioWeek.minutes > 0 && (
        <p style={{ margin: '-6px 2px 14px', fontSize: 13, color: 'var(--color-label-normal)' }}>
          이번 주 유산소 <span className="bt-num" style={{ fontSize: 15 }}>{Math.round(cardioWeek.effectiveMin)}</span>분
          {cardioWeek.vigorousMin > 0 && <span style={{ color: 'var(--color-label-neutral)' }}>(고강도 2배)</span>}
          {cardioWeek.km > 0 && (
            <>
              {' '}· <span className="bt-num" style={{ fontSize: 15 }}>{Math.round(cardioWeek.km * 10) / 10}</span>km
            </>
          )}
          <span style={{ color: 'var(--color-label-neutral)' }}> / 목표 {getTrainingProfile().cardioGoalMin}분</span>
        </p>
      )}
      {(weekLogs.length > 0 || liveExercises?.length > 0) && <MuscleSetsCard logs={weekLogs} liveExercises={liveExercises} compact title="이번 주 근육별 세트" />}
      <PrCard prs={userDoc?.prs} limit={2} title="최근 PR" />

      {nextPt && (
        <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--color-label-normal)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 6, border: '1.5px solid var(--color-primary-normal)', color: 'var(--color-primary-strong)' }}>PT</span>
          <span>다음 PT · <b>{(() => { const [y, mo, da] = nextPt.date.split('-').map(Number); return `${mo}/${da}(${'일월화수목금토'[new Date(y, mo - 1, da).getDay()]})` })()} {nextPt.time}</b>{nextPt.trainerName ? ` · ${nextPt.trainerName}` : ''}</span>
        </p>
      )}
      <div style={{ margin: '0 -20px 4px' }}>
        <CalendarView uid={uid} logsVersion={logsVersion} onMonthSummary={setMonthSummary} onLogsChanged={onLogsChanged} ptByDate={ptByDate} />
      </div>

      {/* [2026-10-28 리디자인] 월 요약 — 카드 대신 주간 요약과 같은 헤어라인 스트립, 숫자는 무채색 */}
      {monthSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', borderTop: '1px solid var(--color-line)', borderBottom: '1px solid var(--color-line)', padding: '14px 0', marginBottom: 20 }}>
          {[
            { icon: Dumbbell, label: `${monthSummary.month + 1}월 운동`, v: monthSummary.workoutDays },
            { icon: Moon, label: `${monthSummary.month + 1}월 휴식`, v: monthSummary.restDays },
          ].map((it, i) => (
            <div key={it.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: i ? 14 : 2, borderLeft: i ? '1px solid var(--color-line)' : 'none' }}>
              <span className="bt-num" style={{ fontSize: 'calc(24px * var(--num-scale))', lineHeight: 1.1 }}>
                <CountUp value={it.v} />
                <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginLeft: 2 }}>일</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <it.icon size={13} strokeWidth={1.75} /> {it.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
