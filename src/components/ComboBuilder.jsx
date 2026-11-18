// ComboBuilder.jsx - [2026-11-17] 식단 조합 만들기: 재료를 팩·개·공기·스쿱 단위로 더하고 빼며 끼니 목표에 얼마나 맞는지 바로 본다.
// 저장은 계정(customSync.js)과 이 기기(utils/nutrition/combos.js). 내 음식은 '내 음식' 분류에서 등록한다. 영양값은 plan.js mealNutrition(식약처 DB·평균 추정 재료). 규칙 계산이며 'AI' 표현을 쓰지 않는다.
import React, { useMemo, useState } from 'react'
import { useRepeatPress } from '../hooks/useRepeatPress'
import { Button, Chip, ScreenHeader } from './ui'
import { FOODS } from '../utils/nutrition/foodsExtra'
import { CATEGORY_FOODS, FOOD_UNITS, USER_COMBO_ITEMS_MAX, USER_COMBO_MAX, USER_FOOD_MAX, combosUsingFood, comboItems, deleteUserCombo, deleteUserFood, isSmallUnit, pushRecent, qtyParts, qtyText, readRecent, readUserCombos, readUserFoods, recentFoodIds, saveUserCombo, saveUserFood, stepValue, unitParts } from '../utils/nutrition/combos'
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

// 단백질이 6g 넘게 모자랄 때 권하는 재료 하나({ food, n, gain, shortP }). 없으면 null
export function adviceOption(list, nut, target) {
  const shortP = target.protein - nut.p
  if (!list.length || shortP < 6) return null
  const have = new Set(list.map((x) => x.food))
  const opts = ADVICE.filter((a) => !have.has(a.food) && FOODS[a.food] && FOOD_UNITS[a.food]).map((a) => ({ ...a, gain: Math.round((FOODS[a.food].p * gramOf(a.food, a.n)) / 100), shortP }))
  return opts.find((o) => o.gain >= shortP * 0.8) || opts.sort((a, b) => b.gain - a.gain)[0] || null
}

export function adviceFor(list, nut, target) {
  const kcalOff = nut.kcal - target.kcal
  const shortP = target.protein - nut.p
  if (!list.length) return '재료를 더해 보세요. 칸마다 − + 로 양을 바꾸고, 숫자를 누르면 직접 쓸 수 있어요.'
  if (shortP >= 6) {
    const pick = adviceOption(list, nut, target)
    if (pick) return `단백질이 ${Math.round(shortP)}g 모자라요. ${FOODS[pick.food].name} ${qtyText(pick.food, pick.n)} 더하면 ${pick.gain}g 채워요.`
    return `단백질이 ${Math.round(shortP)}g 모자라요.`
  }
  if (kcalOff > target.kcal * 0.15) return `목표보다 ${num(Math.round(kcalOff))}kcal 많아요. 밥·고구마를 줄이거나 하나를 빼 보세요.`
  if (kcalOff < -target.kcal * 0.2) return `목표보다 ${num(Math.round(-kcalOff))}kcal 적어요. 과일이나 우유, 밥을 조금 더해도 좋아요.`
  return '목표에 잘 맞아요.'
}

const sig = (l) => l.map((x) => `${x.food}:${x.n}`).join('|')
const MAX_N = 50

// 재료 한 줄: − + (길게 누르면 반복, 작은 단위는 5칸씩), 숫자를 누르면 직접 입력
function ItemRow({ it, onDelta, onSet, onRemove }) {
  const u = FOOD_UNITS[it.food]
  const f = FOODS[it.food]
  const small = isSmallUnit(it.food)
  const minus = useRepeatPress((c) => onDelta(it.food, -1, c > 0 && small ? 5 : 1))
  const plus = useRepeatPress((c) => onDelta(it.food, 1, c > 0 && small ? 5 : 1))
  const [edit, setEdit] = useState(null)
  const parts = qtyParts(it.food, it.n)
  const kcal = Math.round((f.kcal * u.g * it.n) / 100)
  const commit = () => {
    const v = Number(edit)
    setEdit(null)
    if (edit === '' || !Number.isFinite(v)) return
    onSet(it.food, v / unitParts(it.food).k)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: '8px 8px 8px 10px', marginBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border, var(--color-line))', background: 'var(--card-bg)' }}>
      <div style={{ flex: '1 1 140px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, wordBreak: 'keep-all' }}>{f.name}</div>
        <div className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-alternative)' }}>{kcal}kcal · 단백질 {Math.round((f.p * u.g * it.n) / 100)}g</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
      <button aria-label={`${f.name} 줄이기`} {...minus} style={stepBtn}>−</button>
      {edit == null ? (
        <button aria-label={`${f.name} 양 직접 쓰기`} onClick={() => setEdit(String(parts.amount))} className="bt-num" style={{ minWidth: 58, padding: '4px 2px', textAlign: 'center', fontSize: 15, fontWeight: 800, background: 'none', border: 0, borderBottom: '1px dashed var(--color-line)', color: 'var(--color-label-normal)' }}>
          {qtyText(it.food, it.n)}
        </button>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
          <input
            autoFocus
            value={edit}
            inputMode="decimal"
            aria-label={`${f.name} 양`}
            onChange={(e) => setEdit(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            style={{ width: 52, boxSizing: 'border-box', padding: '4px 4px', textAlign: 'center', fontSize: 15, fontWeight: 800, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-fill-strong)', background: 'var(--card-bg)', color: 'var(--color-label-normal)' }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-label-alternative)' }}>{parts.suffix}</span>
        </span>
      )}
      <button aria-label={`${f.name} 늘리기`} {...plus} style={stepBtn}>+</button>
      <button aria-label={`${f.name} 빼기`} onClick={() => onRemove(it.food)} style={{ ...stepBtn, width: 28, height: 28, fontSize: 15, color: 'var(--color-label-alternative)' }}>×</button>
      </div>
    </div>
  )
}

// 시작하기: 이 끼니 목표, 내 조합·최근 조합, 처음부터. initial.list = 지금 메뉴를 재료 1단위 목록으로 푼 것(또는 고른 조합)
export default function ComboBuilder({ uid, target, share, targets, initial, onClose, onApply, onApplyList }) {
  const startList = useMemo(() => (initial?.list || []).filter((x) => FOOD_UNITS[x.food]).map((x) => ({ food: x.food, n: x.n })).slice(0, USER_COMBO_ITEMS_MAX), [initial])
  const [list, setList] = useState(startList)
  const [meta, setMeta] = useState({ mine: !!initial?.mine, id: initial?.mine ? initial?.id || null : null, presetId: initial?.presetId || null, list0: startList })
  const [name, setName] = useState(initial?.mine ? initial.name || '' : '')
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState(() => readUserCombos(uid))
  const [recent, setRecent] = useState(() => readRecent(uid))
  const [msg, setMsg] = useState(() => ((initial?.list || []).length > USER_COMBO_ITEMS_MAX ? `재료가 많아 ${USER_COMBO_ITEMS_MAX}가지만 불러왔어요.` : ''))
  const [myFoods, setMyFoods] = useState(() => readUserFoods(uid))
  const recentFoods = useMemo(() => recentFoodIds(uid), [uid, recent])
  const [cat, setCat] = useState(() => (readUserFoods(uid).length ? 'mine' : recentFoodIds(uid).length ? 'recent' : 0)) // 내 음식 → 최근 → 일반 분류
  const [form, setForm] = useState(null) // 내 음식 등록·수정 { id?, name, unit, kcal, p, c, f, na }
  const [delAsk, setDelAsk] = useState(null) // 조합에 쓰이는 음식을 지울 때 한 번 더 묻기
  // 계정에 올리고 결과를 알린다(실패하면 이 기기에만 저장되고 다음에 열 때 다시 올린다)
  const sync = (okMsg) =>
    pushCustom(uid).then((ok) => setMsg(ok ? okMsg : '이 기기에는 저장했어요. 계정에는 연결되면 다시 올려요.'))
  const nut = useMemo(() => mealNutrition({ items: comboItems(list) }), [list])
  const tgt = { kcal: target.kcal, protein: target.protein, carb: Math.round(targets.carb * share), fat: Math.round(targets.fat * share) }
  const note = estimateNote({ items: comboItems(list) })
  const have = new Set(list.map((x) => x.food))
  const option = useMemo(() => adviceOption(list, nut, tgt), [list, nut]) // eslint-disable-line react-hooks/exhaustive-deps

  const clampN = (n) => Math.min(MAX_N, Math.round(n * 100) / 100)
  // times칸만큼 위·아래로(작은 단위를 길게 누르면 5칸)
  const delta = (food, dir, times = 1) =>
    setList((l) =>
      l
        .map((x) => {
          if (x.food !== food) return x
          let n = x.n
          for (let i = 0; i < times; i += 1) n = stepValue(n, FOOD_UNITS[food].step, dir)
          return { ...x, n: clampN(n) }
        })
        .filter((x) => x.n > 0)
    )
  const setN = (food, n) => setList((l) => l.map((x) => (x.food === food ? { ...x, n: clampN(n) } : x)).filter((x) => x.n > 0))
  const remove = (food) => setList((l) => l.filter((x) => x.food !== food))
  const add = (food, n = 1) => {
    if (list.some((x) => x.food === food)) return
    if (list.length >= USER_COMBO_ITEMS_MAX) {
      setMsg(`재료는 ${USER_COMBO_ITEMS_MAX}가지까지 넣을 수 있어요. 하나를 빼고 더해 주세요.`)
      return
    }
    setMsg('')
    setList((l) => [...l, { food, n }])
  }
  const query = q.trim().replace(/\s+/g, '')
  const found = query ? Object.keys(FOOD_UNITS).filter((f) => FOODS[f] && !FOOD_UNITS[f].hidden && FOODS[f].name.replace(/\s+/g, '').includes(query) && !have.has(f)).slice(0, 10) : []
  const autoName = () => list.slice(0, 2).map((x) => FOODS[x.food].name.replace(/\(.*?\)/g, '').trim()).join(' + ') || '내 조합'
  const unchanged = sig(meta.list0) === sig(list)
  const unchangedPreset = !!meta.presetId && unchanged
  const unchangedMine = meta.mine && !!meta.id && unchanged
  const shortName = (id) => FOODS[id].name.replace(/\(.*?\)/g, '').trim()

  const save = () => {
    if (!meta.mine && readUserCombos(uid).length >= USER_COMBO_MAX) {
      setMsg(`내 조합은 ${USER_COMBO_MAX}개까지 저장해요. 안 쓰는 조합을 지워 주세요(위 ★ 내 조합의 ×).`)
      return null
    }
    const e = saveUserCombo(uid, { id: meta.mine ? meta.id : undefined, name: name.trim() || autoName(), list })
    if (!e) {
      setMsg('저장하지 못했어요. 기기 저장 공간을 확인해 주세요.')
      return null
    }
    setSaved(readUserCombos(uid))
    setMeta({ mine: true, id: e.id, presetId: null, list0: list })
    setMsg(`'${e.name}'을 내 조합에 저장하는 중…`)
    sync(`'${e.name}'을 내 조합에 저장했어요`)
    return e
  }
  const remember = (nm) => pushRecent(uid, { name: nm, list })
  // 저장 없이 이 끼니에만 넣기(저장은 선택)
  const apply = () => {
    if (unchangedPreset) {
      remember(initial?.name)
      return onApply(meta.presetId)
    }
    if (unchangedMine) {
      remember(name.trim() || initial?.name)
      return onApply(meta.id)
    }
    const nm = name.trim() || (initial?.name ? (unchanged ? initial.name : `${initial.name.replace(/ 수정$/, '').slice(0, 15)} 수정`) : autoName())
    remember(nm)
    onApplyList({ name: nm, list })
  }
  const saveAndApply = () => {
    const e = save()
    if (!e) return
    remember(e.name)
    onApply(e.id)
  }
  const submitFood = () => {
    const r = saveUserFood(uid, form)
    if (r.error) {
      setMsg(r.error)
      return
    }
    setMyFoods(readUserFoods(uid))
    setForm(null)
    add(r.entry.id)
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
  // 내 조합·최근 조합을 불러오기(내 조합이면 고치기, 최근 조합이면 새 조합)
  const load = (cb, mine) => {
    const next = cb.list.filter((x) => FOOD_UNITS[x.food]).map((x) => ({ food: x.food, n: x.n }))
    setList(next)
    setName(mine ? cb.name : '')
    setMeta({ mine: !!mine, id: mine ? cb.id : null, presetId: null, list0: next })
    setMsg('')
  }
  const fromScratch = () => {
    setList([])
    setName('')
    setMeta({ mine: false, id: null, presetId: null, list0: [] })
    setMsg('')
  }
  const recentShown = recent.filter((r) => !saved.some((cb) => sig(cb.list) === sig(r.list))).slice(0, 4)
  const tabs = [['mine', '★ 내 음식'], ['recent', '최근'], ...CATEGORY_FOODS.map(([label], k) => [k, label])]
  const foodChip = (f) => (
    <Chip key={f} onClick={() => add(f)}>+ {shortName(f)}</Chip>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 86, background: 'var(--color-bg)', overflowY: 'auto', padding: '0 20px' }}>
      <ScreenHeader title={`${target.label} 조합 만들기`} onBack={onClose} />
      <div className="bt-num" style={{ fontSize: 13, color: 'var(--color-label-alternative)', margin: '4px 0 10px' }}>
        {target.label} 목표 {num(target.kcal)}kcal · 단백질 {target.protein}g · 탄수 {tgt.carb}g · 지방 {tgt.fat}g
      </div>
      {(!!saved.length || !!recentShown.length || (initial?.list || []).length > 0) && (
        <div style={{ marginBottom: 10 }}>
          {!!saved.length && (
            <>
              <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 6 }}>★ 내 조합 · 누르면 불러와요</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {saved.map((cb) => (
                  <span key={cb.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-pill)', border: meta.id === cb.id && meta.mine ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)' }}>
                    <button onClick={() => load(cb, true)} style={{ padding: '6px 4px 6px 12px', fontSize: 13, fontWeight: 700, background: 'none', border: 0, color: 'var(--color-label-normal)' }}>★ {cb.name}</button>
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
          {!!recentShown.length && (
            <>
              <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 6 }}>최근 조합</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {recentShown.map((r, i) => (
                  <Chip key={`${i}-${r.name}`} onClick={() => load(r, false)}>{r.name}</Chip>
                ))}
              </div>
            </>
          )}
          {(initial?.list || []).length > 0 && !!list.length && (
            <button onClick={fromScratch} style={miniBtn}>비우고 처음부터</button>
          )}
        </div>
      )}
      {!!(initial?.list || []).length && unchanged && !!list.length && (
        <div style={{ fontSize: 12, color: 'var(--color-label-alternative)', margin: '0 0 8px' }}>지금 메뉴를 재료 한 가지씩 풀었어요. 양을 바꾸거나 빼고 더해 보세요.</div>
      )}
      {list.map((it) => (
        <ItemRow key={it.food} it={it} onDelta={delta} onSet={setN} onRemove={remove} />
      ))}
      <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', margin: '10px 0 6px' }}>음식 더하기</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="재료 이름 찾기(예: 연어, 곤약, 샌드위치)"
        maxLength={20}
        aria-label="재료 이름 찾기"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--card-bg)', color: 'var(--color-label-normal)', fontSize: 15 }}
      />
      {!!found.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {found.map((f) => (
            <Chip key={f} onClick={() => { add(f); setQ('') }}>+ {shortName(f)}</Chip>
          ))}
        </div>
      )}
      {query && !found.length && <div style={{ fontSize: 13, color: 'var(--color-label-alternative)', marginBottom: 8 }}>찾는 음식이 없어요. 비슷한 이름으로 찾아 보세요.</div>}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
        {tabs.map(([k, label]) => (
          <Chip key={String(k)} active={cat === k} onClick={() => setCat(k)}>{label}</Chip>
        ))}
      </div>
      {cat === 'recent' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {recentFoods.filter((f) => !have.has(f)).map(foodChip)}
          {!recentFoods.length && <div style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>조합을 한 번 넣으면 쓴 재료가 여기에 모여요.</div>}
          {!!recentFoods.length && recentFoods.every((f) => have.has(f)) && <div style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>최근 재료를 모두 넣었어요.</div>}
        </div>
      )}
      {typeof cat === 'number' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {CATEGORY_FOODS[cat][1].filter((f) => !have.has(f)).map(foodChip)}
        </div>
      )}
      {cat === 'mine' && (
        <div style={{ marginBottom: 8 }}>
          {myFoods.map((f) => (
            <div key={f.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Chip onClick={() => add(f.id)} active={have.has(f.id)}>+ {f.name}</Chip>
                <span style={{ flex: 1 }} />
                <button aria-label={`${f.name} 고치기`} onClick={() => setForm({ ...f, na: f.na ?? '' })} style={miniBtn}>고치기</button>
                <button aria-label={`${f.name} 지우기`} onClick={() => removeFood(f)} style={miniBtn}>{delAsk === f.id ? '정말 지우기' : '지우기'}</button>
              </div>
              <div className="bt-num" style={{ fontSize: 12, margin: '2px 0 0 4px', color: 'var(--color-label-alternative)' }}>{f.unit} · {num(f.kcal)}kcal · 단백질 {f.p}g</div>
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

      <div style={{ margin: '14px 0 6px', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border, var(--color-line))', background: 'var(--card-bg)' }}>
        <FitBar label="칼로리" value={nut.kcal} target={tgt.kcal} unit="kcal" />
        <FitBar label="단백질" value={nut.p} target={tgt.protein} unit="g" />
        <FitBar label="탄수" value={nut.c} target={tgt.carb} unit="g" />
        <FitBar label="지방" value={nut.f} target={tgt.fat} unit="g" />
        <div style={{ fontSize: 14, marginTop: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--color-fill-normal, rgba(0,0,0,0.06))' }}>{adviceFor(list, nut, tgt)}</div>
        {option && (
          <button onClick={() => add(option.food, option.n)} style={{ ...miniBtn, marginTop: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-normal)' }}>
            + {FOODS[option.food].name} {qtyText(option.food, option.n)} 추가
          </button>
        )}
        {note && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--color-label-alternative)' }}>{note}</div>}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름(저장할 때 쓰여요. 예: 닭가슴살 도시락)"
        maxLength={20}
        aria-label="조합 이름"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--card-bg)', color: 'var(--color-label-normal)', fontSize: 15 }}
      />
      {msg && !form && <div role="status" style={{ fontSize: 13, marginBottom: 8 }}>{msg}</div>}
      <div style={{ fontSize: 12, color: 'var(--color-label-alternative)', marginBottom: 12 }}>저장한 음식과 조합은 내 계정에 보관돼요. 영양값은 식약처 자료, 시판 제품 값(추정), 내가 입력한 값으로 계산했고, 제품마다 달라 라벨을 확인하세요.</div>
      {/* 아래 고정 바: 지금 합계 + 저장 없이 넣기(주 버튼) + 저장하고 넣기(선택) */}
      <div style={{ position: 'sticky', bottom: 0, margin: '0 -20px', padding: '8px 20px', paddingBottom: 'calc(10px + var(--safe-bottom, 0px))', background: 'var(--color-bg)', borderTop: '1px solid var(--color-line)' }}>
        <div className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-alternative)', marginBottom: 6 }}>
          지금 {num(Math.round(nut.kcal))} / {num(tgt.kcal)}kcal · 단백질 {Math.round(nut.p)} / {tgt.protein}g
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={saveAndApply} disabled={!list.length || unchangedPreset || unchangedMine} style={{ padding: '13px 14px' }}>
            {meta.mine && meta.id ? '고쳐 저장하고 넣기' : '★ 저장하고 넣기'}
          </Button>
          <Button onClick={apply} disabled={!list.length} style={{ flex: 1 }}>{target.label}에 넣기</Button>
        </div>
      </div>
    </div>
  )
}

const miniBtn = { padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-alternative)' }
const fieldStyle = { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--card-bg)', color: 'var(--color-label-normal)', fontSize: 15 }
const stepBtn = { width: 36, height: 36, borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-normal)', fontSize: 18, fontWeight: 700 }
