// ComboBuilder.jsx - [2026-11-17] 식단 조합 만들기: 재료를 팩·개·공기·스쿱 단위로 더하고 빼며 끼니 목표에 얼마나 맞는지 바로 본다.
// 저장은 계정(customSync.js)과 이 기기(utils/nutrition/combos.js). 내 음식은 '내 음식' 분류에서 등록한다. 영양값은 plan.js mealNutrition(식약처 DB·평균 추정 재료). 규칙 계산이며 'AI' 표현을 쓰지 않는다.
import React, { useMemo, useState } from 'react'
import { Button, Chip, ScreenHeader } from './ui'
import { FOODS } from '../utils/nutrition/foodsExtra'
import { CATEGORY_FOODS, FOOD_UNITS, USER_FOOD_MAX, combosUsingFood, comboItems, deleteUserCombo, deleteUserFood, qtyText, readUserCombos, readUserFoods, saveUserCombo, saveUserFood } from '../utils/nutrition/combos'
import { pushCustom } from '../utils/nutrition/customSync'
import { estimateNote, mealNutrition } from '../utils/nutrition/plan'

const num = (v) => Number(v).toLocaleString('ko-KR')
// 단백질이 모자랄 때 권하는 것(작은 것부터)
const ADVICE = [
  { food: 'egg', n: 1 },
  { food: 'soymilk', n: 1 },
  { food: 'greek_yogurt', n: 1 },
  { food: 'protein_drink', n: 1 },
  { food: 'chicken_pack', n: 1 },
  { food: 'protein_powder', n: 1 },
]
const gramOf = (food, n) => FOOD_UNITS[food].g * n

// 목표 대비 막대(90~115% 안이면 강조색, 모자라면 옅게, 넘치면 경고색)
export function FitBar({ label, value, target, unit }) {
  const pct = target ? Math.round((value / target) * 100) : 0
  const ok = pct >= 90 && pct <= 115
  const over = pct > 115
  const color = ok ? 'var(--color-fill-strong)' : over ? 'var(--color-status-danger, #c0392b)' : 'color-mix(in srgb, var(--color-label-normal) 55%, var(--color-bg, #fff))'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 44, fontSize: 13, color: 'var(--color-label-alternative)' }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-fill-normal, rgba(0,0,0,0.08))', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color }} />
      </div>
      <span className="bt-num" style={{ width: 150, textAlign: 'right', fontSize: 12, color: 'var(--color-label-alternative)' }}>
        {num(Math.round(value))}
        {unit} / {num(Math.round(target))}
        {unit} <b style={{ color: over ? color : 'var(--color-label-normal)' }}>{pct}%</b>
      </span>
    </div>
  )
}

export function adviceFor(list, nut, target) {
  const kcalOff = nut.kcal - target.kcal
  const shortP = target.protein - nut.p
  if (!list.length) return '재료를 더해 보세요. 칸마다 − + 로 양을 바꿀 수 있어요.'
  if (shortP >= 6) {
    const have = new Set(list.map((x) => x.food))
    const opts = ADVICE.filter((a) => !have.has(a.food)).map((a) => ({ ...a, gain: Math.round((FOODS[a.food].p * gramOf(a.food, a.n)) / 100) }))
    const pick = opts.find((o) => o.gain >= shortP * 0.8) || opts.sort((a, b) => b.gain - a.gain)[0]
    if (pick) return `단백질이 ${Math.round(shortP)}g 모자라요. ${FOODS[pick.food].name} ${qtyText(pick.food, pick.n)} 더하면 ${pick.gain}g 채워요.`
    return `단백질이 ${Math.round(shortP)}g 모자라요.`
  }
  if (kcalOff > target.kcal * 0.15) return `목표보다 ${num(Math.round(kcalOff))}kcal 많아요. 밥·고구마를 줄이거나 하나를 빼 보세요.`
  if (kcalOff < -target.kcal * 0.2) return `목표보다 ${num(Math.round(-kcalOff))}kcal 적어요. 과일이나 우유, 밥을 조금 더해도 좋아요.`
  return '목표에 잘 맞아요.'
}

export default function ComboBuilder({ uid, target, share, targets, initial, onClose, onApply }) {
  const [list, setList] = useState(() => (initial?.list || []).filter((x) => FOOD_UNITS[x.food]).map((x) => ({ food: x.food, n: x.n })))
  const [meta, setMeta] = useState({ mine: !!initial?.mine, id: initial?.id || null, presetId: initial?.presetId || null, list0: initial?.list || [] })
  const [name, setName] = useState(initial?.mine ? initial.name || '' : '')
  const [q, setQ] = useState('')
  const MINE = CATEGORY_FOODS.length // '내 음식' 분류 번호
  const [cat, setCat] = useState(0)
  const [saved, setSaved] = useState(() => readUserCombos(uid))
  const [msg, setMsg] = useState('')
  const [myFoods, setMyFoods] = useState(() => readUserFoods(uid))
  const [form, setForm] = useState(null) // 내 음식 등록·수정 { id?, name, unit, kcal, p, c, f, na }
  const [delAsk, setDelAsk] = useState(null) // 조합에 쓰이는 음식을 지울 때 한 번 더 묻기
  // 계정에 올리고 결과를 알린다(실패하면 이 기기에만 저장되고 다음에 열 때 다시 올린다)
  const sync = (okMsg) =>
    pushCustom(uid).then((ok) => setMsg(ok ? okMsg : '이 기기에는 저장했어요. 계정에는 연결되면 다시 올려요.'))
  const nut = useMemo(() => mealNutrition({ items: comboItems(list) }), [list])
  const tgt = { kcal: target.kcal, protein: target.protein, carb: Math.round(targets.carb * share), fat: Math.round(targets.fat * share) }
  const note = estimateNote({ items: comboItems(list) })
  const have = new Set(list.map((x) => x.food))

  const change = (food, d) =>
    setList((l) =>
      l
        .map((x) => (x.food === food ? { ...x, n: Math.round((x.n + d * FOOD_UNITS[food].step) * 10) / 10 } : x))
        .filter((x) => x.n > 0)
    )
  const add = (food) => setList((l) => (l.some((x) => x.food === food) ? l : [...l, { food, n: 1 }]))
  const query = q.trim().replace(/\s+/g, '')
  const found = query ? Object.keys(FOOD_UNITS).filter((f) => FOODS[f] && FOODS[f].name.replace(/\s+/g, '').includes(query) && !have.has(f)).slice(0, 8) : []
  const autoName = () => list.slice(0, 2).map((x) => FOODS[x.food].name.replace(/\(.*?\)/g, '').trim()).join(' + ') || '내 조합'
  const unchangedPreset = meta.presetId && JSON.stringify(meta.list0.map((x) => [x.food, x.n])) === JSON.stringify(list.map((x) => [x.food, x.n]))

  const save = () => {
    const e = saveUserCombo(uid, { id: meta.mine ? meta.id : undefined, name: name.trim() || autoName(), list })
    if (!e) {
      setMsg('저장하지 못했어요. 기기 저장 공간을 확인해 주세요.')
      return null
    }
    setSaved(readUserCombos(uid))
    setMeta({ mine: true, id: e.id, presetId: null, list0: [] })
    setMsg(`'${e.name}'을 내 조합에 저장하는 중…`)
    sync(`'${e.name}'을 내 조합에 저장했어요`)
    return e
  }
  const apply = () => {
    if (unchangedPreset) return onApply(meta.presetId)
    const e = save()
    if (e) onApply(e.id)
  }
  const submitFood = () => {
    const r = saveUserFood(uid, form)
    if (r.error) {
      setMsg(r.error)
      return
    }
    setMyFoods(readUserFoods(uid))
    setForm(null)
    setList((l) => (l.some((x) => x.food === r.entry.id) ? l : [...l, { food: r.entry.id, n: 1 }]))
    setMsg(`'${r.entry.name}'을 저장하는 중…`)
    sync(`'${r.entry.name}'을 내 음식에 저장했어요`)
  }
  const removeFood = (f) => {
    const used = combosUsingFood(uid, f.id)
    if (used.length && delAsk !== f.id) {
      setDelAsk(f.id)
      setMsg(`'${f.name}'은 내 조합 ${used.length}개에 쓰이고 있어요. 지우면 그 조합에서도 빠져요. 한 번 더 누르면 지워요.`)
      return
    }
    deleteUserFood(uid, f.id)
    setDelAsk(null)
    setMyFoods(readUserFoods(uid))
    setSaved(readUserCombos(uid))
    setList((l) => l.filter((x) => x.food !== f.id))
    sync(`'${f.name}'을 지웠어요`)
  }
  const load = (cb) => {
    setList(cb.list.filter((x) => FOOD_UNITS[x.food]).map((x) => ({ food: x.food, n: x.n })))
    setName(cb.name)
    setMeta({ mine: true, id: cb.id, presetId: null, list0: [] })
    setMsg('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 86, background: 'var(--color-bg)', overflowY: 'auto', padding: '0 20px 40px', paddingBottom: 'calc(40px + var(--safe-bottom, 0px))' }}>
      <ScreenHeader title={`${target.label} 조합 만들기`} onBack={onClose} />
      <div className="bt-num" style={{ fontSize: 13, color: 'var(--color-label-alternative)', margin: '4px 0 10px' }}>
        {target.label} 목표 {num(target.kcal)}kcal · 단백질 {target.protein}g · 탄수 {tgt.carb}g · 지방 {tgt.fat}g
      </div>
      {!!saved.length && (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 6 }}>★ 내 조합</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {saved.map((cb) => (
              <span key={cb.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)' }}>
                <button onClick={() => load(cb)} style={{ padding: '6px 4px 6px 12px', fontSize: 13, fontWeight: 700, background: 'none', border: 0, color: 'var(--color-label-normal)' }}>★ {cb.name}</button>
                <button
                  aria-label={`${cb.name} 삭제`}
                  onClick={() => {
                    deleteUserCombo(uid, cb.id)
                    setSaved(readUserCombos(uid))
                    sync('내 조합을 지웠어요')
                  }}
                  style={{ padding: '6px 10px 6px 4px', fontSize: 13, background: 'none', border: 0, color: 'var(--color-label-alternative)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </>
      )}
      {list.map((it) => {
        const u = FOOD_UNITS[it.food]
        const f = FOODS[it.food]
        const kcal = Math.round((f.kcal * u.g * it.n) / 100)
        return (
          <div key={it.food} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border, var(--color-line))', background: 'var(--card-bg)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, wordBreak: 'keep-all' }}>{f.name}</div>
              <div className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-alternative)' }}>{kcal}kcal · 단백질 {Math.round((f.p * u.g * it.n) / 100)}g</div>
            </div>
            <button aria-label={`${f.name} 줄이기`} onClick={() => change(it.food, -1)} style={stepBtn}>−</button>
            <span className="bt-num" style={{ minWidth: 58, textAlign: 'center', fontSize: 15, fontWeight: 800 }}>{qtyText(it.food, it.n)}</span>
            <button aria-label={`${f.name} 늘리기`} onClick={() => change(it.food, 1)} style={stepBtn}>+</button>
          </div>
        )
      })}
      <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', margin: '10px 0 6px' }}>음식 더하기</div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
        {CATEGORY_FOODS.map(([label], k) => (
          <Chip key={label} active={cat === k} onClick={() => setCat(k)}>{label}</Chip>
        ))}
        <Chip active={cat === MINE} onClick={() => setCat(MINE)}>★ 내 음식</Chip>
      </div>
      {cat !== MINE && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {CATEGORY_FOODS[cat][1].filter((f) => !have.has(f)).map((f) => (
            <Chip key={f} onClick={() => add(f)}>+ {FOODS[f].name.replace(/\(.*?\)/g, '').trim()}</Chip>
          ))}
        </div>
      )}
      {cat === MINE && (
        <div style={{ marginBottom: 8 }}>
          {myFoods.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Chip onClick={() => add(f.id)} active={have.has(f.id)}>+ {f.name}</Chip>
              <span className="bt-num" style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--color-label-alternative)' }}>{f.unit} · {num(f.kcal)}kcal · 단백질 {f.p}g</span>
              <button aria-label={`${f.name} 고치기`} onClick={() => setForm({ ...f, na: f.na ?? '' })} style={miniBtn}>고치기</button>
              <button aria-label={`${f.name} 지우기`} onClick={() => removeFood(f)} style={miniBtn}>{delAsk === f.id ? '정말 지우기' : '지우기'}</button>
            </div>
          ))}
          {!myFoods.length && !form && <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 6 }}>자주 먹는 음식을 직접 등록하면 조합에서 다른 음식처럼 쓸 수 있어요. 라벨의 영양성분표 숫자를 그대로 적어 주세요.</div>}
          {!form && myFoods.length < USER_FOOD_MAX && <Button variant="ghost" onClick={() => setForm({ name: '', unit: '1개', kcal: '', p: '', c: '', f: '', na: '' })}>+ 내 음식 등록</Button>}
          {form && (
            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border, var(--color-line))', background: 'var(--card-bg)' }}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="음식 이름(예: 우리 집 김밥)" maxLength={20} aria-label="음식 이름" style={{ ...fieldStyle, width: '100%', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>한</span>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="1개" maxLength={8} aria-label="단위" style={{ ...fieldStyle, width: 90, flex: 'none' }} />
                <span style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>당(예: 1개, 1팩, 1줄, 1접시)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
                {[['kcal', '칼로리(kcal)'], ['p', '단백질(g)'], ['c', '탄수화물(g)'], ['f', '지방(g)'], ['na', '나트륨(mg, 선택)']].map(([k, label]) => (
                  <label key={k} style={{ fontSize: 12, color: 'var(--color-label-alternative)' }}>
                    {label}
                    <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" aria-label={label} style={{ ...fieldStyle, width: '100%', marginTop: 2 }} />
                  </label>
                ))}
              </div>
              {msg && <div role="alert" style={{ fontSize: 13, marginBottom: 8, color: 'var(--color-status-danger, #c0392b)' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={submitFood} style={{ flex: 1 }}>저장하고 조합에 넣기</Button>
                <Button variant="ghost" onClick={() => setForm(null)}>취소</Button>
              </div>
            </div>
          )}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="음식 이름 찾기(예: 연어, 곤약, 샌드위치)"
        maxLength={20}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--card-bg)', color: 'var(--color-label-normal)', fontSize: 15 }}
      />
      {!!found.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {found.map((f) => (
            <Chip key={f} onClick={() => { add(f); setQ('') }}>+ {FOODS[f].name.replace(/\(.*?\)/g, '').trim()}</Chip>
          ))}
        </div>
      )}
      {query && !found.length && <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 8 }}>찾는 음식이 없어요. 비슷한 이름으로 찾아 보세요.</div>}

      <div style={{ margin: '14px 0 6px', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border, var(--color-line))', background: 'var(--card-bg)' }}>
        <FitBar label="칼로리" value={nut.kcal} target={tgt.kcal} unit="kcal" />
        <FitBar label="단백질" value={nut.p} target={tgt.protein} unit="g" />
        <FitBar label="탄수" value={nut.c} target={tgt.carb} unit="g" />
        <FitBar label="지방" value={nut.f} target={tgt.fat} unit="g" />
        <div style={{ fontSize: 14, marginTop: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--color-fill-normal, rgba(0,0,0,0.06))' }}>{adviceFor(list, nut, tgt)}</div>
        {note && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--color-label-alternative)' }}>{note}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 붙이기(예: 닭가슴살 도시락)"
          maxLength={20}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--card-bg)', color: 'var(--color-label-normal)', fontSize: 15 }}
        />
        <Button variant="ghost" onClick={save} disabled={!list.length}>★ 내 식단 저장</Button>
      </div>
      {msg && <div role="status" style={{ fontSize: 13, marginBottom: 8 }}>{msg}</div>}
      <Button onClick={apply} disabled={!list.length} style={{ width: '100%' }}>이 조합을 {target.label}에 넣기</Button>
      <div style={{ fontSize: 12, marginTop: 10, color: 'var(--color-label-alternative)' }}>저장한 음식과 조합은 내 계정에 보관돼요. 영양값은 식약처 자료, 시판 제품 값(추정), 내가 입력한 값으로 계산했고, 제품마다 달라 라벨을 확인하세요.</div>
    </div>
  )
}

const miniBtn = { padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-alternative)' }
const fieldStyle = { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--card-bg)', color: 'var(--color-label-normal)', fontSize: 15 }
const stepBtn = { width: 36, height: 36, borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-normal)', fontSize: 18, fontWeight: 700 }
