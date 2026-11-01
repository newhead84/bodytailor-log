// AppGuards.jsx - [2026-11-01] 앱 셸에서 한 줄로 그리는 보이지 않는 보조 작업 모음(App.jsx를 크게 고치지 않으려고 분리)
//  - S6: 예전 계정의 휴대폰 번호 변환값(users.signupInfo.phoneHash)을 memberPrivate로 옮긴다(일괄 스크립트 없이, 앱을 열 때 한 번)
//  - B2: Firestore 하루 한도 초과(resource-exhausted)가 나면 화면 위에 공통 안내를 띄운다
import React, { useEffect, useState } from 'react'
import { migratePhoneHash } from '../storage'

export default function AppGuards({ uid, userDoc }) {
  const [quota, setQuota] = useState(false)
  const hasLegacyHash = !!userDoc?.signupInfo?.phoneHash
  useEffect(() => {
    if (uid && hasLegacyHash) migratePhoneHash(uid, userDoc)
    // userDoc 전체가 아니라 옮길 값이 있는지만 본다(한 번만 시도)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, hasLegacyHash])
  useEffect(() => {
    const on = () => setQuota(true)
    window.addEventListener('bt-quota', on)
    return () => window.removeEventListener('bt-quota', on)
  }, [])
  if (!quota) return null
  return (
    <div
      role="alert"
      className="text-keep-all"
      style={{ position: 'fixed', left: 12, right: 12, top: 'calc(var(--safe-top, 0px) + 10px)', zIndex: 900, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-card)', border: '1px solid var(--color-warning)', color: 'var(--color-label-strong)', fontSize: 13.5, lineHeight: 1.5, boxShadow: 'var(--shadow-card)', display: 'flex', gap: 10, alignItems: 'flex-start' }}
    >
      <span style={{ flex: 1 }}>
        오늘 앱 서버 사용량이 하루 한도에 닿아 저장·불러오기가 잠시 안 될 수 있어요. 한국 시간 오후 4~5시쯤 다시 풀려요. 진행 중인 운동은 이 기기에 남아 있어요.
      </span>
      <button type="button" onClick={() => setQuota(false)} style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-label-neutral)', flexShrink: 0 }}>닫기</button>
    </div>
  )
}
