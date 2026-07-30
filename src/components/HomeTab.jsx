import React, { useEffect, useMemo, useState } from 'react'
import { Dumbbell, Moon } from 'lucide-react'
import { Card, Button } from './ui'
import { getRecentWorkoutLogs } from '../storage'
import CalendarView from './CalendarView'
import { getExerciseDisplayAtom } from '../utils/exerciseLibrary'
import { pickRandomQuote } from '../utils/quotes'

// 로그 하나에서 실제로 수행한 부위들을 중복 없이 뽑아 "가슴·삼두"처럼 요약한다.
function summarizePartsOfLog(log) {
  if (!log?.exercises?.length) return ''
  const atoms = [...new Set(log.exercises.map((ex) => getExerciseDisplayAtom(ex.name)).filter(Boolean))]
  return atoms.join('·')
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// 최근 기록들로부터, 직전에 사용한 루틴에서 다음에 수행할 파트를 추정한다.
// (Firestore에 별도 "사이클 완료" 상태를 아직 두지 않아, 클라이언트에서 최근 로그 기준으로 근사한다.)
function getSuggestedNext(routineTemplates, recentLogs) {
  if (!routineTemplates || routineTemplates.length === 0) return null
  const lastRoutineLog = recentLogs.find((l) => l.sessionType !== 'extra' && l.routineTemplateId && l.partName)
  if (!lastRoutineLog) {
    const t = routineTemplates[0]
    return t?.parts?.[0] ? { template: t, part: t.parts[0] } : null
  }
  const template = routineTemplates.find((t) => t.id === lastRoutineLog.routineTemplateId) || routineTemplates[0]
  if (!template?.parts?.length) return null
  const idx = template.parts.findIndex((p) => p.name === lastRoutineLog.partName)
  const nextIdx = idx === -1 ? 0 : (idx + 1) % template.parts.length
  return { template, part: template.parts[nextIdx] }
}

export default function HomeTab({ uid, userDoc, routineTemplates, logsVersion, workoutPhase, onGoToLog, onCancelWorkout, onLogsChanged }) {
  // [2026-07-30 신규] 기록탭에서 웜업/본운동이 시작되면("오늘 운동 기록하러 가기" 또는
  // "한 세트 더?"를 통해 진입한 경우 모두 포함) 홈탭 카드가 "운동중" 상태로 바뀐다.
  const isWorkoutInProgress = workoutPhase === 'warmup' || workoutPhase === 'main'
  const [recentLogs, setRecentLogs] = useState([])
  const [showExtraCta, setShowExtraCta] = useState(false)
  const [monthSummary, setMonthSummary] = useState(null)
  // [2026-07-29 신규] 앱 진입(마운트) 시마다 응원/습관/자기계발 문구 중 하나를 랜덤으로 뽑는다.
  // (직전 노출 문구와는 연달아 겹치지 않도록 utils/quotes.js에서 처리)
  const [quote] = useState(() => pickRandomQuote())

  useEffect(() => {
    let cancelled = false
    async function load() {
      const logs = await getRecentWorkoutLogs(uid, 10)
      if (cancelled) return
      setRecentLogs(logs)
    }
    load()
    return () => {
      cancelled = true
    }
    // logsVersion: 운동 완료 직후(App.jsx) 값이 올라가며 재조회를 트리거한다(재진입 없이 즉시 반영).
  }, [uid, logsVersion])

  const todayLogs = useMemo(() => recentLogs.filter((l) => l.date === todayStr()), [recentLogs])
  const doneToday = todayLogs.length > 0
  const suggested = useMemo(() => getSuggestedNext(routineTemplates, recentLogs), [routineTemplates, recentLogs])

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
              <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Dumbbell size={13} strokeWidth={1.75} /> {monthSummary.month + 1}월 운동
              </div>
              <div className="record-notation" style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary-normal)' }}>
                {monthSummary.workoutDays}일
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--color-line)' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Moon size={13} strokeWidth={1.75} /> {monthSummary.month + 1}월 휴식
              </div>
              <div className="record-notation" style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-label-strong)' }}>
                {monthSummary.restDays}일
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
