// DietScreen.jsx - [2026-11-12] 식단 제안(Phase2): 운동·체중 기록으로 하루 칼로리·단백질을 정하고
// 편의점·간편식 위주 메뉴로 끼니를 채운다. 먹은 걸 적지 않는다(제안만). 규칙 계산이며 'AI' 표현을 쓰지 않는다.
// 근거·계산: docs/식단제안_설계안_v1.md, utils/nutrition/*. 영양값은 식약처 식품영양성분 통합 DB.
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, Disclosure, ScreenHeader } from './ui'
import { getAllWorkoutLogs, updateUserProfile } from '../storage'
import { todayStr } from '../utils/date'
import { HEALTH_DISCLAIMER } from '../utils/legal'
import { saveFailText } from '../utils/member'
import { computeDiet, dietPrefs, pendingAdjustment, readDietHistory, rememberPlan, rerollSlot } from '../utils/nutrition/dietState'
import { itemLine, dayGapTip } from '../utils/nutrition/plan'
import { AVOID_LABEL, MODE_LABEL } from '../utils/nutrition/meals'
import { FOOD_SOURCE } from '../utils/nutrition/foods'

const STYLE_OPTIONS = [
  ['easy', '편의점·간편식 위주'],
  ['mix', '섞어서'],
  ['cook', '요리도 자주'],
]
const MEAL_OPTIONS = [
  [2, '2끼 + 간식'],
  [3, '3끼'],
  [4, '3끼 + 간식'],
  [5, '3끼 + 간식 2'],
]
const ACTIVITY_OPTIONS = [
  ['sit', '주로 앉아서 일해요'],
  ['move', '많이 걷거나 서서 일해요'],
]
const COOK_OPTIONS = [5, 15, 30]
const DIRECTION_TEXT = { loss: '체지방 줄이기', gain: '근육 키우기', keep: '유지' }

const num = (v) => Number(v).toLocaleString('ko-KR')

function Bar({ value, target, label, unit, over = false }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--color-label-alternative)' }}>{label}</span>
        <span className="bt-num" style={{ color: over && value > target ? 'var(--color-status-danger, #c0392b)' : 'var(--color-label-normal)' }}>
          {num(value)}
          {unit} / {num(target)}
          {unit}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-fill-normal, rgba(0,0,0,0.08))', overflow: 'hidden' }}>
        <div className="bt-bar" style={{ width: `${pct}%`, height: '100%', background: over && value > target ? 'var(--color-status-danger, #c0392b)' : 'var(--color-fill-strong)' }} />
      </div>
    </div>
  )
}

function Setup({ initial, onSave, saving, error }) {
  const [p, setP] = useState(initial)
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const toggleAvoid = (k) => setP((x) => ({ ...x, avoid: x.avoid.includes(k) ? x.avoid.filter((a) => a !== k) : [...x.avoid, k] }))
  const row = (title, children, sub) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: sub ? 2 : 8 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 8 }}>{sub}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  )
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--color-label-alternative)', margin: '4px 0 18px' }}>한 번만 정하면 돼요. 나중에 오른쪽 위 '설정'에서 바꿀 수 있어요.</p>
      {row('주로 어떻게 먹어요?', STYLE_OPTIONS.map(([k, l]) => <Chip key={k} active={p.style === k} onClick={() => set('style', k)}>{l}</Chip>))}
      {row('하루 끼니', MEAL_OPTIONS.map(([k, l]) => <Chip key={k} active={p.meals === k} onClick={() => set('meals', k)}>{l}</Chip>))}
      {row('운동 말고 하루 활동', ACTIVITY_OPTIONS.map(([k, l]) => <Chip key={k} active={p.activity === k} onClick={() => set('activity', k)}>{l}</Chip>))}
      {row('요리는 한 번에 몇 분까지', COOK_OPTIONS.map((k) => <Chip key={k} active={p.cookMin === k} onClick={() => set('cookMin', k)}>{k}분</Chip>))}
      {row(
        '안 먹는 것',
        Object.entries(AVOID_LABEL).map(([k, l]) => <Chip key={k} active={p.avoid.includes(k)} onClick={() => toggleAvoid(k)}>{l}</Chip>),
        '취향만 골라 주세요. 알레르기·질환이 있으면 의사·영양사와 먼저 상의하세요'
      )}
      {error && <p style={{ color: 'var(--color-status-danger, #c0392b)', fontSize: 14 }}>{error}</p>}
      <Button full onClick={() => onSave(p)} disabled={saving}>
        {saving ? '저장 중…' : '이대로 식단 받기'}
      </Button>
    </div>
  )
}

function MealCard({ entry, onSwap }) {
  const { target, meal, scale, nutrition, addon } = entry
  if (!meal) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{target.label}</div>
        <p style={{ fontSize: 14, color: 'var(--color-label-alternative)' }}>조건에 맞는 메뉴가 없어요. '안 먹는 것'을 줄여 보세요.</p>
      </Card>
    )
  }
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-label-alternative)' }}>{target.label}</span>
        <span className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-alternative)' }}>
          목표 {num(target.kcal)}kcal · 단백질 {target.protein}g
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 800, flex: 1, wordBreak: 'keep-all' }}>{meal.name}</div>
        <button onClick={onSwap} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-normal)', fontSize: 13, fontWeight: 700 }}>
          바꾸기
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)' }}>{MODE_LABEL[meal.mode]}</span>
        {meal.minutes > 0 && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)' }}>{meal.minutes}분</span>}
        {scale !== 1 && (
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)' }}>{meal.items.some((x) => !x.unit) ? '양' : '밥'} {scale}배</span>
        )}
      </div>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', fontSize: 14, lineHeight: 1.7, color: 'var(--color-label-normal)' }}>
        {meal.items.map((it, idx) => (
          <li key={idx}>· {itemLine(it, scale)}</li>
        ))}
        {addon && (
          <li style={{ fontWeight: 700 }}>
            + {addon.unit} <span style={{ fontWeight: 500, color: 'var(--color-label-alternative)' }}>(단백질 보충)</span>
          </li>
        )}
      </ul>
      <div className="bt-num" style={{ fontSize: 13, marginTop: 8, color: 'var(--color-label-alternative)' }}>
        {num(nutrition.kcal)}kcal · 단백질 {Math.round(nutrition.p)}g · 나트륨 {num(nutrition.na)}mg
      </div>
      {meal.tip && <div style={{ fontSize: 13, marginTop: 6, color: 'var(--color-label-normal)' }}>{meal.tip}</div>}
      {meal.steps && (
        <Disclosure label="만드는 법" style={{ marginTop: 8 }}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
            {meal.steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </Disclosure>
      )}
    </Card>
  )
}

export default function DietScreen({ uid, userDoc, onClose, onSaved }) {
  const date = todayStr()
  const [logs, setLogs] = useState(null)
  const [history, setHistory] = useState(() => readDietHistory(uid))
  const [editing, setEditing] = useState(!userDoc?.diet)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [adjNote, setAdjNote] = useState(null)

  useEffect(() => {
    let alive = true
    getAllWorkoutLogs(uid)
      .then((l) => alive && setLogs(l))
      .catch(() => alive && setLogs([]))
    return () => {
      alive = false
    }
  }, [uid])

  // 2주마다 체중 추이로 칼로리 보정(쓰기 1번)
  useEffect(() => {
    if (!userDoc?.diet) return
    const p = pendingAdjustment(userDoc)
    if (!p) return
    updateUserProfile(uid, { diet: { ...dietPrefs(userDoc), adj: p.adj, adjAt: p.adjAt } })
      .then(() => {
        if (p.step) setAdjNote(p)
        onSaved?.()
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const diet = useMemo(() => (logs ? computeDiet(userDoc, logs, { uid, date, history }) : null), [userDoc, logs, uid, date, history])
  useEffect(() => {
    if (diet?.plan) setHistory((h) => rememberPlan(uid, date, diet.plan, h))
  }, [diet, uid, date])

  async function savePrefs(p) {
    setSaving(true)
    setError('')
    try {
      await updateUserProfile(uid, { diet: { ...dietPrefs(userDoc), ...p, v: 1 } })
      // 취향이 바뀌면 오늘 고른 메뉴를 다시 고른다
      const h = { ...history }
      delete h[date]
      setHistory(h)
      await onSaved?.()
      setEditing(false)
      if (typeof window !== 'undefined') document.querySelector('[data-diet-scroll]')?.scrollTo(0, 0)
    } catch (err) {
      setError(saveFailText(err))
    } finally {
      setSaving(false)
    }
  }

  const missing = !userDoc?.onboarding?.weightKg || !userDoc?.onboarding?.heightCm || !userDoc?.onboarding?.age
  const t = diet?.targets
  const gap = diet && dayGapTip(diet.plan.total, t)

  return (
    <div data-diet-scroll style={{ height: '100%', overflowY: 'auto', padding: '0 20px 40px' }}>
      <ScreenHeader
        title={editing ? '식단 설정' : '오늘 식단'}
        onBack={editing && userDoc?.diet ? () => setEditing(false) : onClose}
        right={!editing && userDoc?.diet ? <button onClick={() => setEditing(true)} style={{ background: 'none', border: 0, color: 'var(--color-label-normal)', fontSize: 14, fontWeight: 700 }}>설정</button> : null}
      />
      {missing ? (
        <Card style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 15 }}>나이·키·몸무게가 있어야 식단을 맞출 수 있어요. MY › 프로필에서 채워 주세요.</p>
        </Card>
      ) : editing ? (
        <Setup initial={dietPrefs(userDoc)} onSave={savePrefs} saving={saving} error={error} />
      ) : !diet ? (
        <p style={{ color: 'var(--color-label-alternative)', marginTop: 24 }}>불러오는 중…</p>
      ) : (
        <>
          <Card style={{ marginTop: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>하루 목표 · {DIRECTION_TEXT[t.direction]}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 4 }}>
              <span>
                <span className="bt-num" style={{ fontSize: 32, fontWeight: 800 }}>{num(t.kcal)}</span>
                <span style={{ fontSize: 14, marginLeft: 3 }}>kcal</span>
              </span>
              <span>
                <span style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>단백질 </span>
                <span className="bt-num" style={{ fontSize: 22, fontWeight: 800 }}>{t.protein}</span>
                <span style={{ fontSize: 13 }}>g</span>
              </span>
            </div>
            <div className="bt-num" style={{ fontSize: 13, color: 'var(--color-label-alternative)', margin: '4px 0 14px' }}>
              탄수화물 {t.carb}g · 지방 {t.fat}g
              <span style={{ display: 'block', fontWeight: 400 }}>유지 칼로리 {num(t.maintain)}kcal 기준</span>
            </div>
            <Bar label="오늘 식단 칼로리" value={diet.plan.total.kcal} target={t.kcal} unit="kcal" />
            <Bar label="단백질" value={diet.plan.total.p} target={t.protein} unit="g" />
            <Bar label="나트륨(넘지 않게)" value={diet.plan.total.na} target={t.sodiumMax} unit="mg" over />
            {gap && <div style={{ fontSize: 13, marginTop: 4 }}>{gap}</div>}
            {t.minor && <div style={{ fontSize: 13, marginTop: 6 }}>만 19세 미만은 성장기라 칼로리를 줄이지 않고 유지로 맞춰요.</div>}
          </Card>
          {adjNote && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14 }}>
                최근 2주 체중이 주 {adjNote.ratePct > 0 ? '+' : ''}
                {adjNote.ratePct.toFixed(1)}%씩 바뀌어 하루 {adjNote.step > 0 ? '+' : ''}
                {adjNote.step}kcal 맞췄어요.
              </div>
            </Card>
          )}
          {!userDoc?.weightLog?.length && (
            <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 12 }}>체중을 주 2번 이상 적으면(REPORT 체중 추이) 2주마다 칼로리를 맞춰 드려요.</div>
          )}
          {diet.plan.meals.map((entry) => (
            <MealCard key={entry.target.key} entry={entry} onSwap={() => setHistory((h) => rerollSlot(uid, date, entry.target.key, h))} />
          ))}
          <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', margin: '4px 0 12px' }}>
            눈대중: 고기·생선 손바닥 크기 ≈ 단백질 20–25g · 밥 1공기 ≈ 300kcal · 제품마다 다르니 라벨을 확인하세요
          </div>
          <Disclosure label="이렇게 정한 이유">
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 8px' }}>
                기초대사량(나이·키·몸무게)에 일상 활동을 곱하고, 최근 4주 운동 기록의 소모 칼로리를 더해 유지 칼로리를 냈어요. 체지방 줄이기는 15–20% 줄이되 하루 500kcal를 넘게 줄이지 않고, 근육 키우기는 10–15% 더해요.
              </p>
              <p style={{ margin: '0 0 8px' }}>
                단백질은 몸무게 1kg당 {t.proteinPerKg}g이에요. 근력 운동하며 감량할 때는 근육을 지키려고 국민 영양 기준 비율(하루 칼로리의 10–20%)보다 높게 잡았어요(스포츠영양 기준).
              </p>
              <p style={{ margin: '0 0 8px' }}>메뉴 영양값은 재료 무게로 계산했고, 편의점 제품은 같은 종류 여러 제품의 중간값이에요.</p>
              <div style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>
                출처 · 2025 한국인 영양소 섭취기준(보건복지부·한국영양학회) · 기초대사량 공식 비교 체계적 문헌고찰(2005) · 국제스포츠영양학회 체중 감량 식단 입장문(2026)·단백질 입장문(2017) · 근력 운동 중 칼로리 부족 메타분석(2022) · 근육 증가기 영양 리뷰(2019) · 끼니별 단백질 배분 리뷰(2018) · 영양값: {FOOD_SOURCE}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-label-alternative)' }}>
                학술 자료와 공공 데이터를 바탕으로 계산한 일반 정보예요. 질환(신장·당뇨 등)·임신·수유 중이거나 식사 조절이 힘들면 의사·영양사와 상담하세요. {HEALTH_DISCLAIMER}
              </p>
            </div>
          </Disclosure>
        </>
      )}
    </div>
  )
}
