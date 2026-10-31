// TraineesScreen.jsx
// [2026-10-31 신규, Phase2 P2-2] 트레이너 "내 회원": 담당(활성 연결) 회원 목록 → 회원별 최근 8주 운동 기록(읽기 전용).
// 기록 읽기는 firestore.rules isTrainerOf(활성 연결 + 트레이너 역할)가 허용한다. 신체정보는 보여주지 않는다.
// [2026-10-31 P2-3] 회원 화면 상단 "운동 계획": 트레이너가 회원의 루틴(계획)을 만들어 보내고 수정·삭제한다(RoutineSetup forTrainer 재사용).
import React, { useCallback, useEffect, useState } from 'react'
import { BackButton, Button, Card, useConfirm } from './ui'
import RoutineSetup from './RoutineSetup'
import TrainerPlanBadge from './TrainerPlanBadge'
import { useBackableScreen } from '../hooks/useBackableScreen'
import { listMyTrainees, getWorkoutLogsInRange, getRoutineTemplates, saveTrainerPlan, deleteRoutineTemplate, MAX_TRAINER_PLANS } from '../storage'
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

export default function TraineesScreen({ uid, trainerName = '', customExercises = {}, onClose }) {
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

  if (sel) return <MemberLogs conn={sel} uid={uid} trainerName={trainerName || sel.trainerName} customExercises={customExercises} onBack={() => setSel(null)} />
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 80px', boxSizing: 'border-box' }}>
      <BackButton onClick={onClose}>돌아가기</BackButton>
      <h1 style={{ fontSize: 24, margin: '8px 0 6px' }}>내 회원</h1>
      <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>관리자가 연결한 담당 회원이에요. 운동 계획을 만들어 보내고, 회원이 남긴 기록을 볼 수 있어요(기록 수정은 회원만).</p>
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

function MemberLogs({ conn, uid, trainerName, customExercises, onBack }) {
  const [logs, setLogs] = useState(null)
  const [open, setOpen] = useState({})
  const [editing, setEditing] = useState(null) // null | 'new' | template
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
            window.alert(e?.message?.startsWith('한 회원') ? e.message : '계획을 저장하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.')
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
