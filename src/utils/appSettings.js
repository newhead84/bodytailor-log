// appSettings.js - [2026-11-13 신규] 앱 운영 방식(settings/app)을 화면들이 함께 보는 저장소
//  - appMode: 'gym'(타입 1, 헬스장형 - 기본) | 'open'(타입 2, 일반형: 가입 즉시 사용, 트레이너·PT·회원권·보유 기구 숨김)
//  - membershipExternal: true면 회원권·PT 횟수·PT 일정은 다른 시스템(출입 관리 프로그램 등)에서 관리 - 그 화면만 숨김(헬스장형에서만 의미)
//  - gymEquip: 센터 보유 기구(utils/gymEquip.js)
// 로그인 사용자 누구나 읽을 수 있는 문서라, 앱을 열고 처음 한 번 읽어 기기에 6시간 보관한다(Spark 읽기 한도 절약).
// 관리자가 바꾸면 그 기기는 바로, 다른 기기는 보관 시간이 지나 다시 읽을 때 반영된다.
import { useSyncExternalStore } from 'react'
import { getAppSettings } from '../storage'

const CACHE_KEY = 'bt-app-settings'
const TTL = 6 * 60 * 60 * 1000
export const APP_MODES = { gym: '헬스장형', open: '일반형' }

export function normalizeAppSettings(raw) {
  return {
    appMode: raw?.appMode === 'open' ? 'open' : 'gym',
    membershipExternal: raw?.membershipExternal === true,
    gymEquip: raw?.gymEquip || null,
  }
}
const DEFAULTS = normalizeAppSettings(null)

// 헬스장형인가(트레이너 연결·트레이너 소개·PT 상담·보유 기구)
export const isGymMode = (s) => (s || DEFAULTS).appMode !== 'open'
// 회원권·PT 횟수·PT 일정을 이 앱에서 관리하는가
export const managesMembership = (s) => isGymMode(s) && !(s || DEFAULTS).membershipExternal

let state = null
let loading = null
const subs = new Set()
const emit = () => subs.forEach((f) => f())
const subscribe = (f) => {
  subs.add(f)
  return () => subs.delete(f)
}
function save(v) {
  state = v
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), v }))
  } catch {
    /* 저장 공간이 막혀도 이번 실행에서는 그대로 씀 */
  }
  emit()
}
function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return c && Date.now() - c.at < TTL ? normalizeAppSettings(c.v) : null
  } catch {
    return null
  }
}

// 서버에서 새로 읽는다(가입 직전처럼 정확해야 할 때). 실패하면 보관본 또는 기본값.
export function loadAppSettings({ fresh = false } = {}) {
  if (!fresh) {
    if (state) return Promise.resolve(state)
    const c = readCache()
    if (c) {
      state = c
      return Promise.resolve(c)
    }
  }
  if (!loading) {
    loading = getAppSettings()
      .then((s) => {
        save(normalizeAppSettings(s))
        return state
      })
      .catch(() => state || DEFAULTS)
      .finally(() => {
        loading = null
      })
  }
  return loading
}

// 관리자가 저장한 값을 이 기기에 바로 반영
export function setAppSettingsLocal(patch) {
  save(normalizeAppSettings({ ...(state || DEFAULTS), ...patch }))
}

// 읽는 중에는 기본값(헬스장형)으로 그린다. 서버 읽기는 한 번만 시도한다(로그인 전 실패 등) - 로그인하면 App이 loadAppSettings()를 다시 부른다.
let attempted = false
export function useAppSettings() {
  if (!state && !loading && !attempted) {
    attempted = true
    const c = readCache()
    if (c) state = c
    else loadAppSettings()
  }
  return useSyncExternalStore(subscribe, () => state || DEFAULTS)
}

export function clearAppSettingsCache() {
  state = null
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* 무시 */
  }
}
