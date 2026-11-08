// FitnessCheckScreen.jsx - [2026-11-07] 체력 점검(분기마다 한 번, 선택)
// 생활 체력 6가지(매달리기·벽 앉기·들고 걷기·바닥에서 일어나기 + 선택: 악력·12분 걷기/달리기)를 직접 재서 적는다.
// 등급은 매기지 않고 지난 점검과 비교만 한다(사용자 결정). 저장: fitnessTests/{uid}/tests, 담당 트레이너는 읽기만.
import React, { useEffect, useState } from 'react'
import { Button, Card, Disclosure, ScreenHeader, useConfirm } from './ui'
import { listFitnessTests, addFitnessTest, deleteFitnessTest } from '../storage'
import { todayStr } from '../utils/date'
import { HEALTH_DISCLAIMER } from '../utils/legal'
import { FITNESS_ITEMS, fitnessDerived, daysSince } from '../utils/fitnessCheck'

const inputStyle = {
  width: '100%',
  height: 48,
  padding: '0 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-line)',
  background: 'var(--color-bg-card)',
  color: 'var(--color-label-strong)',
  fontSize: 17,
  fontFamily: 'var(--font-num, inherit)',
}

export default function FitnessCheckScreen({ uid, weightKg, onClose, backRef = null }) {
  const confirm = useConfirm()
  const [tests, setTests] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    listFitnessTests(uid)
      .then((l) => alive && setTests(l))
      .catch(() => alive && setTests([]))
    return () => {
      alive = false
    }
  }, [uid])

  // [2026-11-07] 기기 뒤로가기: 입력 중이면 입력만 닫는다(화면 위 ‹와 같게)
  if (backRef) backRef.current = adding ? () => setAdding(false) : null
  const last = tests?.[0] || null
  const prev = tests?.[1] || null

  async function save() {
    const data = { date: todayStr() }
    let any = false
    FITNESS_ITEMS.forEach((it) =>
      it.fields.forEach((f) => {
        const raw = form[f.key]
        if (raw === '' || raw == null) return
        const v = Number(raw)
        if (!Number.isFinite(v) || v < 0 || v > f.max) return
        data[f.key] = f.step < 1 ? Math.round(v * 10) / 10 : Math.round(v)
        any = true
      })
    )
    if (!any) {
      setError('한 가지 이상 적어 주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addFitnessTest(uid, data)
      const l = await listFitnessTests(uid)
      setTests(l)
      setAdding(false)
      setForm({})
    } catch (e) {
      setError('저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(t) {
    if (!(await confirm(`${t.date} 점검 기록을 지울까요?`, { okLabel: '삭제', cancelLabel: '취소' }))) return
    try {
      await deleteFitnessTest(uid, t.id)
      setTests(await listFitnessTests(uid))
    } catch (e) {
      setError('지우지 못했어요. 다시 시도해 주세요.')
    }
  }

  return (
    <div style={{ padding: '0 20px 40px', height: '100%', overflowY: 'auto' }}>
      <ScreenHeader title="체력 점검" onBack={adding ? () => setAdding(false) : onClose} />
      {!adding ? (
        <>
          <p className="text-keep-all" style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--color-label-normal)' }}>
            나이 들어서도 혼자 들고, 오르고, 일어나는 힘을 석 달에 한 번 재 봐요. 점수를 매기지 않고 지난번의 나와만 비교해요.
          </p>
          {tests === null ? (
            <p style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
          ) : (
            <>
              <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                {last ? `마지막 점검 ${last.date} (${daysSince(last.date) === 0 ? '오늘' : `${daysSince(last.date)}일 전`})${daysSince(last.date) >= 90 ? ' · 다시 잴 때가 됐어요' : ` · 다음 점검은 약 ${90 - daysSince(last.date)}일 뒤`}` : '아직 점검 기록이 없어요.'}
              </p>
              <Button full onClick={() => { setForm({}); setError(''); setAdding(true) }} style={{ marginBottom: 16 }}>
                오늘 점검하기
              </Button>
              {last && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)', marginBottom: 10 }}>
                    최근 점검 <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-label-neutral)' }}><span style={{ whiteSpace: 'nowrap' }}>{last.date}</span>{prev ? <> · 지난번 <span style={{ whiteSpace: 'nowrap' }}>{prev.date}</span> 대비</> : ''}</span>
                  </div>
                  <ResultRows test={last} prev={prev} weightKg={weightKg} />
                </Card>
              )}
              {tests.length > 1 && (
                <Disclosure label={`지난 점검 ${tests.length - 1}개`} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tests.slice(1).map((t) => (
                      <div key={t.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)', marginBottom: 4 }}>
                          {t.date}
                          <button type="button" onClick={() => remove(t)} style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>삭제</button>
                        </div>
                        <ResultRows test={t} weightKg={weightKg} compact />
                      </div>
                    ))}
                  </div>
                </Disclosure>
              )}
              {last && (
                <button type="button" onClick={() => remove(last)} style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', marginBottom: 12 }}>
                  최근 점검 기록 지우기
                </button>
              )}
              {error && <p role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
            </>
          )}
          <Notes />
        </>
      ) : (
        <>
          <p className="text-keep-all" style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-label-normal)' }}>
            할 수 있는 것만 재서 적어요. 몸을 충분히 푼 뒤, 하나 끝나면 2–3분 쉬고 다음 것을 해요.
            {/* [2026-11-08] T-18: 최대 노력 검사라 시작 전에 보이게 */}
            <br />
            <strong style={{ color: 'var(--color-label-strong)' }}>가슴 통증·어지러움·숨이 너무 차면 바로 멈추고 쉬어요.</strong> 치료 중인 질환이 있으면 먼저 의사와 상의해요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {FITNESS_ITEMS.map((it) => (
              <Card key={it.id}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--color-label-strong)', marginBottom: 4 }}>
                  {it.label}
                  {it.optional && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)' }}>선택</span>}
                </div>
                <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'pre-line' }}>{it.how}</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${it.fields.length}, minmax(0, 1fr))`, gap: 8 }}>
                  {it.fields.map((f) => (
                    <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{f.label}</span>
                      <input
                        type="number"
                        inputMode={f.step < 1 ? 'decimal' : 'numeric'}
                        min="0"
                        max={f.max}
                        step={f.step}
                        value={form[f.key] ?? ''}
                        onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={last?.[f.key] != null ? `지난번 ${last[f.key]}` : ''}
                        style={inputStyle}
                        aria-label={`${it.label} ${f.label}`}
                      />
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          {error && <p role="alert" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
          <Button full disabled={saving} onClick={save}>
            {saving ? '저장 중…' : '저장'}
          </Button>
          <Button full variant="secondary" disabled={saving} onClick={() => setAdding(false)} style={{ marginTop: 8 }}>
            취소
          </Button>
          <Notes />
        </>
      )}
    </div>
  )
}

function Notes() {
  return (
    <Disclosure label="왜 이걸 재나요?" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>
          손아귀 힘, 바닥에서 혼자 일어나는 능력, 심폐 체력이 좋은 사람일수록 오래 건강하게 사는 경향이 여러 연구에서 나타났어요. 매달리기·벽 앉기·들고 걷기는 그 힘을 헬스장에서 쉽게 잴 수 있게 고른 동작이에요.
        </p>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 11.5, color: 'var(--color-label-neutral)' }}>
          출처 · 17개국 악력 연구(2015), 앉았다 일어나기 검사 연구(2012), 심폐 체력과 사망 위험 연구(2018) · 관찰 연구라 '함께 나타난다'는 뜻이에요.
        </p>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 11.5, color: 'var(--color-label-neutral)' }}>
          통증이 있거나 어지러우면 바로 멈추세요. 담당 트레이너가 있으면 트레이너도 기록을 볼 수 있어요. {HEALTH_DISCLAIMER}
        </p>
      </div>
    </Disclosure>
  )
}

export function ResultRows({ test, prev = null, weightKg = 0, compact = false }) {
  const rows = fitnessDerived(test, weightKg)
  const prevRows = prev ? Object.fromEntries(fitnessDerived(prev, weightKg).map((r) => [r.id, r])) : {}
  if (!rows.length) return <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>적은 항목이 없어요.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8 }}>
      {rows.map((r) => {
        const p = prevRows[r.id]
        const d = p && p.value != null && r.value != null ? (r.pct ? (p.value > 0 ? Math.round(((r.value - p.value) / p.value) * 100) : null) : Math.round((r.value - p.value) * 10) / 10) : null
        return (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'baseline' }}>
            <span className="text-keep-all" style={{ fontSize: compact ? 12.5 : 14, color: 'var(--color-label-normal)', minWidth: 0 }}>
              {r.label}
              {r.sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>{r.sub}</span>}
            </span>
            <span className="bt-num" style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: 'var(--color-label-strong)', whiteSpace: 'nowrap' }}>
              {r.text}
              {d != null && d !== 0 && (
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: d > 0 ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)' }}>
                  {d > 0 ? '▲' : '▼'}{Math.abs(d)}{r.pct ? '%' : ''}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
