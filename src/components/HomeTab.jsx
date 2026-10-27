import React, { useEffect, useMemo, useState } from 'react'
import { Dumbbell, Moon, ClipboardCheck } from 'lucide-react'
import { Card, Button, useConfirm } from './ui'
import { getRecentWorkoutLogs, getWorkoutLogsInRange } from '../storage'
import { MuscleSetsCard, PrCard, startOfWeekStr } from './InsightCards'
import { suggestNextSet, workingSetsOf } from '../utils/strength'
import { makeExerciseKey, parseExerciseKey } from '../utils/exerciseKey'
import { CountUp } from '../hooks/useCountUp'
import CalendarView from './CalendarView'
import { getExerciseDisplayAtom } from '../utils/exerciseLibrary'
import { getSuggestedNext } from '../utils/routineSuggestion'
import { pickRandomQuote } from '../utils/quotes'
import { todayStr } from '../utils/date'

// 로그 하나에서 실제로 수행한 부위들을 중복 없이 뽑아 "가슴·삼두"처럼 요약한다.
function summarizePartsOfLog(log) {
  if (!log?.exercises?.length) return ''
  const atoms = [...new Set(log.exercises.map((ex) => getExerciseDisplayAtom(ex.name)).filter(Boolean))]
  return atoms.join('·')
}

export default function HomeTab({
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
  const [monthSummary, setMonthSummary] = useState(null)
  // [신규] "오늘 날짜"를 state로 들고 있어야, 자정을 넘긴 뒤 새 기록 없이 앱이 계속 켜져 있어도
  // (또는 백그라운드에 있다가 다음날 포그라운드로 복귀해도) doneToday가 재계산된다. 기존에는
  // useMemo가 recentLogs에만 의존해서, 날짜만 바뀌고 기록 배열 자체는 그대로면 어제의
  // "오늘도 득근!" 완료 상태가 그대로 남아있었다.
  const [today, setToday] = useState(() => todayStr())
  // [2026-07-29 신규] 앱 진입(마운트) 시마다 응원/습관/자기계발 문구 중 하나를 랜덤으로 뽑는다.
  // (직전 노출 문구와는 연달아 겹치지 않도록 utils/quotes.js에서 처리)
  const [quote] = useState(() => pickRandomQuote())

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
  const weekStats = useMemo(() => {
    const sessions = new Set(weekLogs.map((l) => l.date)).size
    let sets = 0
    weekLogs.forEach((l) => (l.exercises || []).forEach((e) => (sets += workingSetsOf(e).length)))
    const volume = weekLogs.reduce((v, l) => v + (l.totalVolume || 0), 0)
    return { sessions, sets, volume }
  }, [weekLogs])

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
      {/* [2026-07-29] 인사말을 "안녕하세요! OOO님!" / 랜덤 문구 2줄로 분리.
          문구 줄은 색상 대비를 높이고, 문구 뱅크(quotes.js) 길이가 제각각이라도
          항상 1줄을 넘지 않도록 nowrap + ellipsis로 안전하게 자른다. */}
      <p className="text-keep-all" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-label-strong)', margin: '0 0 2px' }}>
        안녕하세요! {userDoc?.nickname || '회원'}님!
      </p>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-label-normal)',
          margin: '0 0 4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {quote}
      </p>

      {/* [2026-10-27 신규] "오늘 운동 완료"를 누르지 않고 방치된 세션을 자동 저장했을 때의 안내 */}
      {autoNotice && (
        <Card className="bt-slide-down" style={{ marginBottom: 12, border: '1px solid var(--color-primary-normal)' }}>
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

      <Card style={{ marginBottom: 20 }}>
        <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-label-normal)' }}>
          {recentLogs[0]
            ? `최근 기록: ${recentLogs[0].date}${
                summarizePartsOfLog(recentLogs[0]) ? ` · ${summarizePartsOfLog(recentLogs[0])}` : ''
              }`
            : '아직 기록이 없어요. 첫 세트를 시작해 볼까요?'}
        </p>
        {suggested && !doneToday && (
          <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            오늘은 <b style={{ color: 'var(--color-primary-strong)' }}>{suggested.template.title} · {suggested.part.name}</b>{' '}
            차례예요.
          </p>
        )}
        {suggested && !doneToday && increaseList.length > 0 && (
          <p className="text-keep-all" style={{ margin: '-4px 0 12px', fontSize: 12.5, color: 'var(--color-label-normal)' }}>
            ▲ 증량 추천 {increaseList.length}종목 ·{' '}
            {increaseList
              .slice(0, 3)
              .map((x) => `${x.name} ${x.weight}kg`)
              .join(', ')}
            {increaseList.length > 3 ? ' 외' : ''}
          </p>
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
      </Card>

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
          { v: weekStats.volume >= 1000 ? Math.round(weekStats.volume / 100) / 10 : weekStats.volume, unit: weekStats.volume >= 1000 ? 't' : 'kg', label: '총 볼륨', d: weekStats.volume >= 1000 ? 1 : 0 },
        ].map((it, i) => (
          <div key={it.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: i ? 14 : 2, borderLeft: i ? '1px solid var(--color-line)' : 'none' }}>
            <span className="bt-num" style={{ fontSize: 'calc(26px * var(--num-scale))', lineHeight: 1.1 }}>
              <CountUp value={it.v} decimals={it.d} />
              <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginLeft: 2 }}>{it.unit}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{it.label}</span>
          </div>
        ))}
      </div>
      {weekLogs.length > 0 && <MuscleSetsCard logs={weekLogs} compact title="이번 주 근육별 세트" />}
      <PrCard prs={userDoc?.prs} limit={2} title="최근 PR" />

      <div style={{ margin: '0 -20px 4px' }}>
        <CalendarView uid={uid} logsVersion={logsVersion} onMonthSummary={setMonthSummary} onLogsChanged={onLogsChanged} />
      </div>

      {monthSummary && (
        <Card style={{ marginBottom: 20 }}>
          {/* [2026-07-29 수정] ①숫자와 라벨 상하 순서를 반전(라벨이 위, 숫자가 아래)
              ②운동일수 색상을 칙칙한 --color-primary-strong(#B8860B, 아이언 티어용으로 의도적으로
              남겨둔 톤) 대신, 디자인가이드 v2.1의 비비드 골드 --color-primary-normal(#FFC94D)로 교체 */}
          <div className="text-keep-all" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 12, lineHeight: '14px', color: 'var(--color-label-neutral)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Dumbbell size={13} strokeWidth={1.75} /> {monthSummary.month + 1}월 운동
              </div>
              <div className="record-notation" style={{ fontSize: 20, lineHeight: '20px', fontWeight: 800, color: 'var(--color-primary-normal)' }}>
                {monthSummary.workoutDays}일
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--color-line)' }} />
            <div>
              <div style={{ fontSize: 12, lineHeight: '14px', color: 'var(--color-label-neutral)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Moon size={13} strokeWidth={1.75} /> {monthSummary.month + 1}월 휴식
              </div>
              <div className="record-notation" style={{ fontSize: 20, lineHeight: '20px', fontWeight: 800, color: 'var(--color-label-strong)' }}>
                {monthSummary.restDays}일
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
