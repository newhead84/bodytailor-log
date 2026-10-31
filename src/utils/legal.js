// legal.js — [2026-10-31 신규] 개인정보 동의·면책 문구·운영자 정보(한곳에서 관리)
// 동의 문구나 처리방침이 크게 바뀌면 CONSENT_VERSION을 올린다 → 모든 계정이 다음 접속 때 한 번 다시 동의한다.
// 처리방침 전문은 public/privacy/index.html(로그인 없이 열림). 운영자 정보가 바뀌면 두 곳을 함께 고친다.

export const CONSENT_VERSION = '2026-10-31'

// 운영자 정보 — 개인정보 보호책임자 이름·연락처는 운영자가 확정해 채운다(처리방침 public/privacy/index.html도 같이).
export const OPERATOR = {
  service: 'BodyTailor Log',
  name: '바디테일러 PT&헬스',
  privacyUrl: '/privacy/',
  licensesUrl: '/oss-licenses.txt',
}

// 건강 관련 안내 면책(운동 정보이며 진단·치료가 아님)
export const HEALTH_DISCLAIMER =
  '앱의 운동·스트레칭·무게 추천은 일반적인 운동 정보예요. 의학적 진단이나 치료가 아니에요. 통증·질환·임신 등 건강 문제가 있으면 운동 전에 의사나 전문가와 상담하세요.'

// users.consents: { version, agreedAt(ms), age14, privacy, body, overseas }
export function hasCurrentConsent(userDoc) {
  const c = userDoc?.consents
  return !!c && c.version === CONSENT_VERSION && c.age14 === true && c.privacy === true && c.body === true
}
