// gymEquip.js - [2026-11-13 신규] 센터 보유 기구
// 관리자가 /admin 설정에서 등록(settings/app.gymEquip = { kinds: [기구 종류], items: [머신·유산소 종목 이름] }).
// 바벨·덤벨처럼 종류만 보면 되는 것은 kinds, 센터마다 다른 머신·유산소 기구는 종목별 items.
// 맨몸·기구가 필요 없는 종목은 늘 할 수 있음('free' - '보유' 표시는 안 붙이고 '보유 기구만' 거르기에는 남김).
// 값은 앱 설정 저장소(utils/appSettings - 한 번 읽고 기기에 6시간 보관)에서 온다.
import { isGymMode, useAppSettings } from './appSettings'
import { EXERCISE_LIBRARY, getExerciseAtom } from './exerciseLibrary'
import { getEquipment } from './exerciseGuides'

export const GYM_KINDS = ['바벨', '덤벨', '스미스머신', '케이블', '원판', '풀업 바', '딥스 바', '밴드', '앱롤러']
export const GYM_ITEM_KINDS = ['머신', '유산소 기구']
const NO_EQUIP_NAMES = ['실외러닝', '줄넘기']
export const GYM_LABEL = '보유'

const equipOf = (name) => getEquipment(name, getExerciseAtom(name))

// 종목별로 고르는 머신·유산소 목록(관리자 화면)
export function gymItemCandidates() {
  const names = [...new Set(Object.values(EXERCISE_LIBRARY).flat())]
  return GYM_ITEM_KINDS.map((kind) => ({ kind, names: names.filter((n) => !NO_EQUIP_NAMES.includes(n) && equipOf(n) === kind) }))
}

export function normalizeGymEquip(raw) {
  const kinds = Array.isArray(raw?.kinds) ? raw.kinds.filter((k) => GYM_KINDS.includes(k)) : []
  const all = gymItemCandidates().flatMap((g) => g.names)
  const items = Array.isArray(raw?.items) ? raw.items.filter((n) => all.includes(n)) : []
  return { kinds: [...new Set(kinds)], items: [...new Set(items)] }
}
export const isGymConfigured = (g) => !!g && (g.kinds.length > 0 || g.items.length > 0)

// 'have'(센터에 있음) | 'free'(기구 없이 가능) | 'none'(등록 안 됨) | null(센터가 아직 등록하지 않음)
export function gymStatus(name, g) {
  if (!isGymConfigured(g)) return null
  const eq = equipOf(name)
  if (eq === '맨몸' || NO_EQUIP_NAMES.includes(name)) return 'free'
  if (GYM_ITEM_KINDS.includes(eq)) return g.items.includes(name) ? 'have' : 'none'
  return g.kinds.includes(eq) ? 'have' : 'none'
}

// ---- 회원 화면: 앱 설정 저장소(utils/appSettings)에서 꺼낸다. 일반형(타입 2)이면 보유 기구 표시 없음 ----
let lastRaw, lastNorm = null
export function useGymEquip() {
  const s = useAppSettings()
  if (!isGymMode(s)) return null
  if (s.gymEquip !== lastRaw) {
    lastRaw = s.gymEquip
    lastNorm = normalizeGymEquip(s.gymEquip)
  }
  return lastNorm
}
