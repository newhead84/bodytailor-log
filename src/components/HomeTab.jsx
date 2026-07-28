import React, { useEffect, useMemo, useState } from 'react'
import { Card, SectionTitle, Button } from './ui'
import { getRecentWorkoutLogs } from '../storage'
import { getExerciseDisplayAtom, PART_COLORS } from '../utils/exerciseLibrary'
import CalendarView from './CalendarView'

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

export default function HomeTab({ uid, userDoc, routineTemplates, onGoToLog }) {
  const [recentLogs, setRecentLogs] = useState([])
  const [showExtraCta, setShowExtraCta] = useState(false)

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
  }, [uid])

  const todayLogs = useMemo(() => recentLogs.filter((l) => l.date === todayStr()), [recentLogs])
  const doneToday = todayLogs.length > 0
  const suggested = useMemo(() => getSuggestedNext(routineTemplates, recentLogs), [routineTemplates, recentLogs])

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 4px' }}>
        {userDoc?.nickname || '회원'}님, 오늘도 몸에 투자할 시간이에요.
      </p>

      <SectionTitle>오늘의 운동</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-label-normal)' }}>
          {recentLogs[0] ? `최근 기록: ${recentLogs[0].date}` : '아직 기록이 없어요. 첫 세트를 시작해 볼까요?'}
        </p>
        {suggested && !doneToday && (
          <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            루틴 순서상 다음은 <b style={{ color: 'var(--color-primary-strong)' }}>{suggested.template.title} · {suggested.part.name}</b>{' '}
            차례예요.
          </p>
        )}

        {!doneToday || showExtraCta ? (
          <Button full onClick={onGoToLog}>
            오늘 운동 기록하러 가기
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button full disabled style={{ flex: 1 }}>
              오늘도 득근! 수고하셨습니다!
            </Button>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowExtraCta(true)}>
              대단하시네요 더 하시게요?
            </Button>
          </div>
        )}
      </Card>

      <div style={{ margin: '0 -20px 4px' }}>
        <CalendarView uid={uid} />
      </div>

      {recentLogs.length > 0 && (
        <>
          <SectionTitle>최근 운동 기록</SectionTitle>
          {recentLogs.slice(0, 3).map((log) => (
            <Card key={log.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{log.date}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-label-neutral)' }}>
                  {log.totalDurationSec > 0 && <span>{Math.round(log.totalDurationSec / 60)}분</span>}
                  {log.caloriesKcal > 0 && <span>{log.caloriesKcal}kcal</span>}
                  <PartDots exercises={log.exercises} />
                </div>
              </div>
              {log.exercises.slice(0, 3).map((ex) => (
                <div key={ex.name} style={{ fontSize: 13, color: 'var(--color-label-normal)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ flexShrink: 0 }}>{ex.name}</span>
                  <span className="record-notation h-scroll" style={{ display: 'block', minWidth: 0 }}>
                    {ex.sets.map((s) => `${s.weight}x${s.reps}`).join('/')}
                  </span>
                </div>
              ))}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

// 부위별 색상 점(가슴/등/팔/어깨/코어/하체/유산소)으로 어떤 부위를 했는지 한눈에 보여준다.
export function PartDots({ exercises }) {
  const atoms = [...new Set((exercises || []).map((ex) => getExerciseDisplayAtom(ex.name)).filter(Boolean))]
  if (atoms.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {atoms.map((atom) => (
        <span
          key={atom}
          title={atom}
          style={{ width: 7, height: 7, borderRadius: '50%', background: PART_COLORS[atom] || 'var(--color-label-neutral)' }}
        />
      ))}
    </div>
  )
}
