// TraineesScreen.jsx
// [2026-10-31 신규, Phase2 P2-2] 트레이너 "내 회원": 담당(활성 연결) 회원 목록 → 회원별 최근 8주 운동 기록(읽기 전용).
// 기록 읽기는 firestore.rules isTrainerOf(활성 연결 + 트레이너 역할)가 허용한다. 신체정보는 보여주지 않는다.
import React, { useEffect, useState } from 'react'
import { BackButton, Card } from './ui'
import { listMyTrainees, getWorkoutLogsInRange } from '../storage'
import { toLocalDateStr } from '../utils/date'
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

export default function TraineesScreen({ uid, onClose }) {
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  useEffect(() => {
    listMyTrainees(uid)
      .then((l) => setList(l.sort((a, b) => String(a.memberName).localeCompare(String(b.memberName), 'ko'))))
      .catch((err) => {
        console.error('담당 회원 불러오기 실패:', err)
        setList([])
      })
  }, [uid])

  if (sel) return <MemberLogs conn={sel} onBack={() => setSel(null)} />
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 80px', boxSizing: 'border-box' }}>
      <BackButton onClick={onClose}>돌아가기</BackButton>
      <h1 style={{ fontSize: 24, margin: '8px 0 6px' }}>내 회원</h1>
      <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>관리자가 연결한 담당 회원이에요. 회원의 운동 기록을 볼 수 있어요(수정은 회원만).</p>
      {list === null ? (
        <p style={{ color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : list.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>아직 연결된 회원이 없어요. 관리자에게 연결을 요청해 주세요.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((c) => (
            <Card key={c.id} onClick={() => setSel(c)}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{c.memberName}{c.memberNickname ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}> · {c.memberNickname}</span> : null}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>기록 보기 ›</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberLogs({ conn, onBack }) {
  const [logs, setLogs] = useState(null)
  const [open, setOpen] = useState({})
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
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 80px', boxSizing: 'border-box' }}>
      <BackButton onClick={onBack}>회원 목록</BackButton>
      <h1 style={{ fontSize: 24, margin: '8px 0 4px' }}>{conn.memberName}</h1>
      <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>최근 8주 운동 기록 · 이번 주 <span className="bt-num">{thisWeekDays}</span>일 운동</p>
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
