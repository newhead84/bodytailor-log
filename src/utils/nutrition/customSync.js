// customSync.js - [2026-11-17] 내 음식·내 조합을 계정(Firestore dietCustom/{uid}/items/{id})과 맞춘다.
// 로컬(combos.js readCustom)이 먼저 바뀌고, 여기서 dirty·deleted 목록만 올린다. 오프라인·규칙 미게시로 실패하면 목록을 남겨 다음에 다시 올린다.
// 문서 모양: 음식 { kind:'food', name, unit, kcal, p, c, f, na?, at }(ID uf0–uf59), 조합 { kind:'combo', name, list:[{food,n}], at }(ID uc0–uc29).
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { COMBO_ID_RE, FOOD_ID_RE, cleanUserFood, loadUserMeals, readCustom, writeCustom } from './combos'

const PULL_MIN_MS = 6 * 60 * 60 * 1000 // 올릴 것이 없으면 6시간에 한 번만 읽는다(읽기 한도 절약)

export const hasPending = (uid) => {
  const d = readCustom(uid)
  return d.dirty.length > 0 || d.deleted.length > 0
}

// 올리기: dirty는 쓰고 deleted는 지운다. 성공하면 목록을 비운다. 반환 true/false
export async function pushCustom(uid) {
  const data = readCustom(uid)
  if (!data.dirty.length && !data.deleted.length) return true
  try {
    const batch = writeBatch(db)
    const col = (id) => doc(db, 'dietCustom', uid, 'items', id)
    data.dirty.forEach((id) => {
      const food = data.foods.find((x) => x.id === id)
      if (food) {
        const { id: _drop, ...rest } = food
        batch.set(col(id), { kind: 'food', ...rest, at: serverTimestamp() })
        return
      }
      const cb = data.combos.find((x) => x.id === id)
      if (cb) batch.set(col(id), { kind: 'combo', name: cb.name, list: cb.list, at: serverTimestamp() })
    })
    data.deleted.forEach((id) => batch.delete(col(id)))
    await batch.commit()
    // 올리는 사이 새로 바뀐 것은 남긴다
    const now = readCustom(uid)
    writeCustom(uid, { ...now, dirty: now.dirty.filter((id) => !data.dirty.includes(id)), deleted: now.deleted.filter((id) => !data.deleted.includes(id)) })
    return true
  } catch (e) {
    console.warn('내 식단 계정 저장 보류:', e?.code || e)
    return false
  }
}

// 열 때 맞추기: ① 올릴 것이 있으면 먼저 올림 ② 올릴 것이 없으면 계정 내용을 읽어 기기에 반영(없으면 기기 것을 올림 = 옛 기기 보관분 옮기기)
// 반환 { ok, changed }
export async function pullCustom(uid, { force = false } = {}) {
  const local = readCustom(uid)
  if (local.dirty.length || local.deleted.length) {
    const ok = await pushCustom(uid)
    return { ok, changed: false }
  }
  if (!force && local.pulledAt && Date.now() - local.pulledAt < PULL_MIN_MS) return { ok: true, changed: false }
  try {
    const snap = await getDocs(collection(db, 'dietCustom', uid, 'items'))
    if (snap.empty && (local.foods.length || local.combos.length)) {
      // 계정에 아직 없는 기기 보관분은 계정으로 옮긴다
      writeCustom(uid, { ...local, dirty: [...local.foods.map((x) => x.id), ...local.combos.map((x) => x.id)] })
      const ok = await pushCustom(uid)
      return { ok, changed: false }
    }
    const foods = []
    const combos = []
    snap.forEach((d) => {
      const v = d.data()
      if (v.kind === 'food' && FOOD_ID_RE.test(d.id)) {
        const f = cleanUserFood({ ...v, id: d.id })
        if (f) foods.push({ ...f, id: d.id })
      } else if (v.kind === 'combo' && COMBO_ID_RE.test(d.id) && Array.isArray(v.list)) {
        combos.push({ id: d.id, name: String(v.name || '내 조합').slice(0, 20), list: v.list.filter((it) => it && typeof it.food === 'string' && Number(it.n) > 0).slice(0, 12).map((it) => ({ food: it.food, n: Number(it.n) })) })
      }
    })
    const same = JSON.stringify({ f: local.foods, c: local.combos }) === JSON.stringify({ f: foods, c: combos })
    writeCustom(uid, { v: 1, foods, combos: combos.filter((c) => c.list.length), dirty: [], deleted: [], pulledAt: Date.now() })
    loadUserMeals(uid)
    return { ok: true, changed: !same }
  } catch (e) {
    console.warn('내 식단 계정 읽기 보류:', e?.code || e)
    return { ok: false, changed: false }
  }
}
