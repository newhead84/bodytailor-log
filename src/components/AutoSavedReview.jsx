// AutoSavedReview.jsx
// [2026-10-29 신규] "오늘 운동 완료"를 누르지 않아 자동 저장된 기록을, 다음에 앱을 열었을 때 팝업으로 확인·수정한다.
//  - 운동 시간(웜업 분·본운동 분)과 종목별 세트(무게×횟수 / 유산소 칸)를 바로 고치거나 안 한 세트를 지울 수 있다.
//  - 저장: 기록을 고친 내용으로 갱신(볼륨·칼로리 다시 계산, XP는 그대로). 그대로 둘게요: 닫기. 기록 삭제: 기록 + 받은 XP 되돌리기.
//  - 옛 알림(세트 정보 없이 저장된 것)은 시간·세트 편집 없이 확인/삭제만 보여 준다.
import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './ui'
import { updateWorkoutLog } from '../storage'
import { getExerciseInputType } from '../utils/exerciseLibrary'
import { getCardioFieldsForSet, toSavedCardioSet } from '../utils/cardioFields'
import { logVolumeKg, getBodyweightKg, weightUnitShort, repsUnit } from '../utils/load'
import { estimateCaloriesV2 } from '../utils/calories'

const inputStyle = {
  width: '100%',
  minWidth: 0,
  height: 38,
  padding: '0 6px',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-label-strong)',
  fontSize: 15,
  fontWeight: 700,
  textAlign: 'center',
}
const unitStyle = { fontSize: 11.5, color: 'var(--color-label-neutral)', flexShrink: 0 }
const selectAll = (e) => {
  const el = e.target
  setTimeout(() => {
    try {
      el.select()
    } catch (err) {
      // 무시
    }
  }, 0)
}

function toMin(sec) {
  return sec > 0 ? String(Math.round(sec / 60)) : ''
}

export default function AutoSavedReview({ uid, notice, onClose, onUndo, onSaved }) {
  const editable = Array.isArray(notice?.exercises)
  const initWarm = notice?.warmupActualSec != null ? toMin(notice.warmupActualSec) : ''
  const initMain = toMin(Math.max(0, (notice?.totalDurationSec || 0) - (notice?.warmupActualSec || 0)))
  const [warmMin, setWarmMin] = useState(initWarm)
  const [mainMin, setMainMin] = useState(initMain)
  const [exercises, setExercises] = useState(() => (editable ? notice.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s })) })) : []))
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const cleaned = useMemo(
    () =>
      exercises
        .map((ex) => {
          const type = ex.inputType || getExerciseInputType(ex.name)
          const sets = ex.sets
            .map((s) => {
              if (type === 'cardio') return { ...s, ...toSavedCardioSet(ex.name, s) }
              if (type === 'reps') return { ...s, weight: 0, reps: Number(s.reps) || 0 }
              return { ...s, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }
            })
            // 무게 칸을 비우면 0kg 세트가 아니라 빈 세트로 보고 뺀다(운동 완료 저장과 같은 기준)
            .filter((s, j) => (type === 'cardio' ? s.durationMin > 0 : s.reps > 0 && (type === 'reps' || String(ex.sets[j]?.weight ?? '').trim() !== '')))
          return { ...ex, sets }
        })
        .filter((ex) => ex.sets.length > 0),
    [exercises]
  )
  const volume = useMemo(() => Math.round(logVolumeKg({ exercises: cleaned })), [cleaned])
  const workingSets = cleaned.reduce((n, ex) => n + ex.sets.filter((s) => s.type !== 'warmup').length, 0)

  function patchSet(ei, si, field, value) {
    setExercises((prev) => prev.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, [field]: value } : s)) })))
  }
  function removeSet(ei, si) {
    setExercises((prev) => prev.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== si) })))
  }

  async function handleSave() {
    if (cleaned.length === 0) {
      setError('남은 세트가 없어요. 기록을 지우려면 "기록 삭제"를 눌러 주세요.')
      return
    }
    setBusy('save')
    setError('')
    try {
      // 시간 칸을 고치지 않았으면 원래 초 단위 시간을 그대로 쓴다(분 반올림으로 깎이지 않게)
      const timeChanged = warmMin !== initWarm || mainMin !== initMain
      const warm = timeChanged ? Math.max(0, Number(warmMin) || 0) * 60 : notice.warmupActualSec || 0
      const totalDurationSec = timeChanged ? warm + Math.max(0, Number(mainMin) || 0) * 60 : notice.totalDurationSec || 0
      await updateWorkoutLog(uid, notice.logId, {
        exercises: cleaned,
        totalVolume: volume,
        totalDurationSec,
        warmupActualSec: !timeChanged ? (notice.warmupActualSec ?? null) : warmMin === '' && notice.warmupActualSec == null ? null : warm,
        caloriesKcal: estimateCaloriesV2(getBodyweightKg(), cleaned, totalDurationSec),
      })
      onSaved?.()
      onClose?.()
    } catch (err) {
      console.error('자동 저장 기록 수정 실패:', err)
      setError('저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(null)
    }
  }

  async function handleUndo() {
    setBusy('undo')
    try {
      await onUndo?.()
    } finally {
      setBusy(null)
    }
  }

  if (!notice || typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="자동 저장된 운동 확인" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,16,10,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        className="bt-slide-up"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '18px 18px 10px' }}>
          <div className="text-keep-all" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-label-strong)' }}>완료하지 않은 운동을 저장해 뒀어요</span>
            <span style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
              {notice.date} · "오늘 운동 완료"를 누르지 않아 마지막 세트 시각까지로 자동 저장했어요. 실제와 다르면 고쳐 주세요.
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 18px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {editable && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-label-strong)' }}>운동 시간</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {[
                  ['웜업', warmMin, setWarmMin],
                  ['본운동', mainMin, setMainMin],
                ].map(([label, v, set]) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--color-label-normal)', flexShrink: 0 }}>{label}</span>
                    <input type="number" inputMode="numeric" value={v} onFocus={selectAll} onChange={(e) => set(e.target.value)} className="bt-num" style={inputStyle} />
                    <span style={unitStyle}>분</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {editable &&
            exercises.map((ex, ei) => {
              const type = ex.inputType || getExerciseInputType(ex.name)
              return (
                <div key={`${ex.name}-${ei}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="text-keep-all" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-label-strong)' }}>
                    {ex.name}
                    {ex.grip ? ` (${ex.grip})` : ''}
                  </span>
                  {ex.sets.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>남은 세트 없음 — 저장하면 이 종목은 빠져요</span>}
                  {ex.sets.map((s, si) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="bt-num" style={{ width: 20, flexShrink: 0, fontSize: 12.5, color: 'var(--color-label-neutral)', textAlign: 'center' }}>
                        {s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : si + 1}
                      </span>
                      {type === 'cardio' ? (
                        getCardioFieldsForSet(ex.name, s).map((f) => (
                          <React.Fragment key={f.key}>
                            <input type="number" inputMode="decimal" value={s[f.key] ?? ''} aria-label={`${f.label} ${f.unit}`} onFocus={selectAll} onChange={(e) => patchSet(ei, si, f.key, e.target.value)} className="bt-num" style={inputStyle} />
                            <span style={unitStyle}>{f.unit}</span>
                          </React.Fragment>
                        ))
                      ) : (
                        <>
                          {type !== 'reps' && (
                            <>
                              <input type="number" inputMode="decimal" value={s.weight ?? ''} aria-label="무게" onFocus={selectAll} onChange={(e) => patchSet(ei, si, 'weight', e.target.value)} className="bt-num" style={inputStyle} />
                              <span style={unitStyle}>{weightUnitShort(ex.name)} ×</span>
                            </>
                          )}
                          <input type="number" inputMode="numeric" value={s.reps ?? ''} aria-label="횟수" onFocus={selectAll} onChange={(e) => patchSet(ei, si, 'reps', e.target.value)} className="bt-num" style={inputStyle} />
                          <span style={unitStyle}>{repsUnit(ex.name)}</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSet(ei, si)}
                        aria-label={`${ex.name} ${si + 1}세트 지우기`}
                        style={{ width: 36, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', color: 'var(--color-label-neutral)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}

          {editable && (
            <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              본세트 <span className="bt-num">{workingSets}</span>세트 · 총 볼륨 <span className="bt-num">{volume.toLocaleString()}</span>kg · 이미 받은 경험치는 그대로예요
            </span>
          )}
          {error && <span style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 18px 16px', borderTop: '1px solid var(--color-line)' }}>
          <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={!!busy} onClick={handleUndo}>
            {busy === 'undo' ? '삭제 중…' : '기록 삭제'}
          </Button>
          {editable ? (
            <>
              <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={!!busy} onClick={onClose}>
                그대로 둘게요
              </Button>
              <Button style={{ flex: 1, minWidth: 0 }} disabled={!!busy} onClick={handleSave}>
                {busy === 'save' ? '저장 중…' : '저장'}
              </Button>
            </>
          ) : (
            <Button style={{ flex: 1, minWidth: 0 }} disabled={!!busy} onClick={onClose}>
              확인
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
