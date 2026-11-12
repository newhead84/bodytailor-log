// DietScreen.jsx - [2026-11-12] 식단 제안(Phase2): 운동·체중 기록으로 하루 칼로리·단백질을 정하고
// 편의점·간편식 위주 메뉴로 끼니를 채운다. 먹은 걸 적지 않는다(제안만). 규칙 계산이며 'AI' 표현을 쓰지 않는다.
// 근거·계산: docs/식단제안_설계안_v1.md, utils/nutrition/*. 영양값은 식약처 식품영양성분 통합 DB.
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, Disclosure, ScreenHeader, Term } from './ui'
import { getAllWorkoutLogs, updateUserProfile } from '../storage'
import { todayStr } from '../utils/date'
import { HEALTH_DISCLAIMER } from '../utils/legal'
import { saveFailText } from '../utils/member'
import { computeDiet, dietPrefs, pendingAdjustment, plateauInfo, readDietHistory, rememberPlan, rerollSlot } from '../utils/nutrition/dietState'
import { itemLine, dayGapTip } from '../utils/nutrition/plan'
import { AVOID_LABEL, MODE_LABEL } from '../utils/nutrition/meals'
import { FOOD_SOURCE } from '../utils/nutrition/foods'
import { EATING_OUT, eatingOutPortions } from '../utils/nutrition/eatingOut'

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
        {target.timing && (
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontWeight: 700 }}>
            {target.timing === 'pre' ? '운동 전' : '운동 후'}
          </span>
        )}
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
      {target.timing && (
        <div style={{ fontSize: 13, marginTop: 6, color: 'var(--color-label-normal)' }}>
          {target.timing === 'pre' ? '운동 1–4시간 전 · 밥·고구마·바나나 같은 탄수화물로 힘을 채워요' : '운동 뒤 1–2시간 안 · 단백질 20g 이상을 꼭 채워요'}
        </div>
      )}
      {meal.tip && <div style={{ fontSize: 13, marginTop: 6, color: 'var(--color-label-normal)' }}>{meal.tip}</div>}
      {meal.src && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--color-label-alternative)' }}>영양값: {meal.src}</div>}
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

  const [plateauTip, setPlateauTip] = useState('')
  const plateau = useMemo(() => (plateauTip ? null : plateauInfo(userDoc)), [userDoc, plateauTip])
  async function answerPlateau(kept) {
    const prefs = dietPrefs(userDoc)
    const now = Date.now()
    const step = !kept ? 0 : plateau.direction === 'loss' ? -100 : 100
    const adj = Math.max(-300, Math.min(300, (prefs.adj || 0) + step))
    try {
      await updateUserProfile(uid, { diet: { ...prefs, adj, adjAt: now, plateauAskedAt: now } })
      setPlateauTip(
        kept
          ? `하루 ${step > 0 ? '+' : ''}${step}kcal 맞췄어요. 2주 뒤 체중을 다시 봐요.`
          : '칼로리를 더 바꾸기보다 지킬 수 있는 끼니부터 늘려 봐요. 설정에서 "편의점·간편식 위주"로 바꾸면 고르기 쉬워져요.'
      )
      onSaved?.()
    } catch (err) {
      setPlateauTip(saveFailText(err))
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
              <span style={{ display: 'block', fontWeight: 400 }}><Term k="유지 칼로리">유지 칼로리</Term> {num(t.maintain)}kcal 기준</span>
              <span style={{ display: 'block', fontWeight: 400 }}>
                <Term k="기초대사량">기초대사량</Term> {num(t.bmr)}kcal · {t.bmrMethod === 'inbody' ? `인바디 기준(체지방 ${t.bmrBodyFat}%)` : t.staleInbody ? '키·몸무게 기준(인바디 6개월 지남)' : '키·몸무게·나이 기준'}
              </span>
              {t.bmrMethod !== 'inbody' && (
                <span style={{ display: 'block', fontWeight: 400 }}>MY 프로필에 인바디를 넣으면 더 정확해요</span>
              )}
            </div>
            <Bar label="오늘 식단 칼로리" value={diet.plan.total.kcal} target={t.kcal} unit="kcal" />
            <Bar label="단백질" value={diet.plan.total.p} target={t.protein} unit="g" />
            <Bar label="나트륨(넘지 않게)" value={diet.plan.total.na} target={t.sodiumMax} unit="mg" over />
            {gap && <div style={{ fontSize: 13, marginTop: 4 }}>{gap}</div>}
            {t.minor && <div style={{ fontSize: 13, marginTop: 6 }}>만 19세 미만은 성장기라 칼로리를 줄이지 않고 유지로 맞춰요.</div>}
          </Card>
          {diet.timing?.hour != null && (
            <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 12 }}>
              운동은 보통 {Math.floor(diet.timing.hour)}시쯤 · {diet.timing.trainingDay ? '오늘은 운동하는 날이라 운동 전후 끼니를 조금 늘렸어요' : '운동하는 날엔 운동 전후 끼니가 조금 늘어요'}
            </div>
          )}
          {plateau && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>체중이 6주째 거의 그대로예요</div>
              <div style={{ fontSize: 14, color: 'var(--color-label-alternative)', margin: '4px 0 10px' }}>
                제안한 식단을 실제로 얼마나 지켰나요? 칼로리를 바로 더 {plateau.direction === 'loss' ? '줄이지' : '늘리지'} 않고 먼저 여쭤봐요.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => answerPlateau(true)}>거의 지켰어요</Button>
                <Button variant="ghost" onClick={() => answerPlateau(false)}>자주 못 지켰어요</Button>
              </div>
            </Card>
          )}
          {plateauTip && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14 }}>{plateauTip}</div>
            </Card>
          )}
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
          <EatingOutTips meals={diet.plan.meals} />
          <Disclosure label="이렇게 정한 이유">
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 8px' }}>
                <Term k="기초대사량">기초대사량</Term>(인바디 체지방률이 있으면 제지방량(체중에서 지방을 뺀 무게)으로, 없으면 나이·키·몸무게로)에 일상 활동을 곱하고, 최근 4주 운동 기록의 소모 칼로리를 더해 유지 칼로리를 냈어요. 체지방 줄이기는 15–20% 줄이되 하루 500kcal를 넘게 줄이지 않고, 근육 키우기는 10–15% 더해요.
              </p>
              <p style={{ margin: '0 0 8px' }}>
                단백질은 몸무게 1kg당 {t.proteinPerKg}g이에요. 근력 운동하며 감량할 때는 근육을 지키려고 국민 영양 기준 비율(하루 칼로리의 10–20%)보다 높게 잡았어요(스포츠영양 기준).
              </p>
              <p style={{ margin: '0 0 8px' }}>메뉴 영양값은 재료 무게로 계산했고, 식당 음식은 식약처 음식 자료의 1인분 값, 편의점 제품은 같은 종류 여러 제품의 중간값이에요. 자료에 없는 메뉴(돼지국밥·규동 등)는 재료를 합산했다고 카드에 적었어요.</p>
              <div style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>
                출처 · 2025 한국인 영양소 섭취기준(보건복지부·한국영양학회) · 기초대사량 공식 비교 체계적 문헌고찰(2005) · 제지방량 기준 기초대사량 공식(캐치-맥아들) · 국제스포츠영양학회 체중 감량 식단 입장문(2026)·단백질 입장문(2017) · 근력 운동 중 칼로리 부족 메타분석(2022) · 근육 증가기 영양 리뷰(2019) · 끼니별 단백질 배분 리뷰(2018) · 영양값: {FOOD_SOURCE}
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

// [2026-11-12 신규] 치킨·피자·회식 날: 가장 큰 끼니 목표 칼로리 안에서 먹을 양을 숫자로(식약처 음식 자료 중간값)
function EatingOutTips({ meals }) {
  const big = Math.max(...(meals || []).map((e) => (e.target.slot === 'snack' ? 0 : e.target.kcal || 0)), 0)
  const q = eatingOutPortions(big)
  const E = EATING_OUT
  const row = (title, body) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: 'var(--color-label-alternative)', whiteSpace: 'pre-line' }}>{body}</div>
    </div>
  )
  return (
    <Disclosure label="치킨·피자·회식 날">
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <div style={{ marginBottom: 10 }}>그 끼니 목표 {big.toLocaleString()}kcal 안에서 이만큼이면 돼요.</div>
        {row(`치킨 약 ${q.chickenG}g`, `후라이드 100g ≈ ${E.chicken.kcal100}kcal · 단백질 ${Math.round(E.chicken.p100)}g\n튀김옷·껍질을 조금 덜면 칼로리가 줄어요. 무나 샐러드를 곁들여요.`)}
        {row(`피자 ${q.pizzaSlices}조각`, `라지 1조각(약 ${E.pizzaSlice.g}g) ≈ ${E.pizzaSlice.kcal}kcal · 단백질 ${Math.round(E.pizzaSlice.p)}g\n도우 끝(엣지)을 남기고 샐러드를 먼저 먹어요.`)}
        {row(`고기 회식 · 삼겹살 약 ${q.samgyeopG}g / 족발 약 ${q.jokbalG}g`, `삼겹살구이 100g ≈ ${E.samgyeop.kcal100}kcal, 족발 100g ≈ ${E.jokbal.kcal100}kcal · 단백질 ${Math.round(E.jokbal.p100)}g\n쌈채소를 먼저 먹고, 볶음밥·면은 나눠 먹어요.`)}
        {row('술', `소주 1병(${E.soju.ml}ml) ≈ ${E.soju.kcal}kcal · 맥주 ${E.beer.ml}ml ≈ ${E.beer.kcal}kcal\n술은 근육 회복을 늦춰요. 운동한 날은 줄이고 물을 같이 마셔요.`)}
        {row('그날 하루', '다른 끼니는 단백질은 지키고 밥·면만 줄여요.\n다음 날 굶지 말고 평소대로 먹으면 돼요.')}
        <div style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>
          출처 · 식약처 식품영양성분 통합 DB 음식 자료 중간값(후라이드 치킨 {E.chicken.n}개·라지 피자 {E.pizzaSlice.n.toLocaleString()}개 제품) · 술은 알코올 1g = 7kcal로 계산 · 알코올과 근육 단백질 합성 연구(2014)
        </div>
      </div>
    </Disclosure>
  )
}
