// MemberPendingScreen.jsx
// [2026-10-31 신규, Phase2 P2-1] 헬스장 회원 승인 전(대기·거절·만료) 화면. 온보딩은 마쳤지만 승인 전에는
// 기록·루틴 화면에 들어가지 않는다(firestore.rules도 미승인 계정의 기록 쓰기를 막음).
import React, { useState } from 'react'
import { Button } from './ui'
import { logout } from '../firebase'
import { updateUserProfile } from '../storage'
import { isValidMobile, phoneHash, phoneLast4 } from '../utils/member'

const COPY = {
  pending: { title: '가입 신청을 받았어요', body: '헬스장에서 회원 정보를 확인하고 승인하면 바로 쓸 수 있어요. 승인되면 이 화면에서 "승인 확인하기"를 눌러 주세요.' },
  rejected: { title: '회원 확인이 안 됐어요', body: '헬스장 회원 명단에서 정보를 찾지 못했어요. 이름·휴대폰 번호를 헬스장에 확인해 주세요.' },
  expired: { title: '회원 기간이 끝났어요', body: '헬스장 이용 기간이 끝나 새 기록을 남길 수 없어요. 그동안의 기록은 그대로 남아 있어요. 재등록 후 헬스장에 알려 주세요.' },
}

export default function MemberPendingScreen({ uid, userDoc, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const [msg, setMsg] = useState('')
  // 신청 정보(이름·휴대폰) 오타 수정 - 본인은 signupInfo를 고칠 수 있다(승인 상태는 관리자만)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(userDoc?.signupInfo?.name || '')
  const [phone, setPhone] = useState('')
  async function saveInfo() {
    if (!name.trim() || !isValidMobile(phone)) return
    setChecking(true)
    try {
      await updateUserProfile(uid, { signupInfo: { name: name.trim().slice(0, 30), phoneHash: await phoneHash(phone), phoneLast4: phoneLast4(phone) } })
      await onRefresh?.()
      setEditing(false)
      setPhone('')
      setMsg('신청 정보를 고쳤어요. 헬스장에 다시 확인을 요청해 주세요.')
    } catch (err) {
      console.error('신청 정보 수정 실패:', err)
      setMsg('고치지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setChecking(false)
    }
  }
  const c = COPY[userDoc?.memberStatus] || COPY.pending
  async function handleCheck() {
    setChecking(true)
    setMsg('')
    try {
      const still = await onRefresh?.()
      if (still) setMsg('아직 승인 전이에요. 조금 뒤에 다시 확인해 주세요.')
    } finally {
      setChecking(false)
    }
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(var(--safe-top, 0px) + 48px) 24px calc(var(--safe-bottom, 0px) + 32px)', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-normal)', margin: '0 0 10px' }}>바디테일러 PT&amp;헬스 회원 전용</p>
        <h1 className="text-keep-all" style={{ fontSize: 28, lineHeight: 1.3, margin: '0 0 14px', color: 'var(--color-label-strong)' }}>{c.title}</h1>
        <p className="text-keep-all" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-label-normal)', margin: 0 }}>{c.body}</p>
        {userDoc?.signupInfo?.name && !editing && (
          <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginTop: 18 }}>
            신청 정보: {userDoc.signupInfo.name} · 휴대폰 끝자리 <span className="bt-num">{userDoc.signupInfo.phoneLast4}</span>{' '}
            <button type="button" onClick={() => setEditing(true)} style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-normal)', textDecoration: 'underline', padding: 0 }}>정보 고치기</button>
          </p>
        )}
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="이름(헬스장에 등록한 이름)" aria-label="이름" style={{ padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 16 }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, '').slice(0, 13))} inputMode="tel" placeholder="휴대폰 번호(010-0000-0000)" aria-label="휴대폰 번호" style={{ padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setEditing(false)}>취소</Button>
              <Button disabled={checking || !name.trim() || !isValidMobile(phone)} onClick={saveInfo}>저장</Button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
          <a href="https://blog.naver.com/bodytailor" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-label-normal)', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', textDecoration: 'none' }}>헬스장 블로그</a>
          <a href="https://www.instagram.com/body_tailor_pt" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-label-normal)', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', textDecoration: 'none' }}>인스타그램</a>
        </div>
      </div>
      {msg && <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', textAlign: 'center', margin: '0 0 10px' }}>{msg}</p>}
      <Button full onClick={handleCheck} disabled={checking}>{checking ? '확인 중…' : '승인 확인하기'}</Button>
      <Button variant="ghost" full onClick={logout} style={{ marginTop: 8 }}>로그아웃</Button>
    </div>
  )
}
