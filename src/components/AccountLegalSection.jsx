// AccountLegalSection.jsx — [2026-10-31 신규] MY › 설정 맨 아래 "약관·개인정보" + "계정 삭제(탈퇴)"
//  - 개인정보 처리방침(/privacy/), 오픈소스 라이선스 고지(/oss-licenses.txt), 건강 정보 면책
//  - 탈퇴: 구글 로그인 재확인 → 본인 데이터 삭제(storage.deleteMyAccountData) → 구글 계정 연결(Firebase 계정) 삭제
import React, { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button, Card, SectionTitle } from './ui'
import { reauthWithGoogle, deleteCurrentAuthUser, logout, clearLocalDataAndReload } from '../firebase'
import { deleteMyAccountData } from '../storage'
import { OPERATOR, HEALTH_DISCLAIMER } from '../utils/legal'

const linkStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 44, fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)', textDecoration: 'none' }
const OSS = [
  ['React · React DOM', 'MIT'],
  ['Firebase JS SDK', 'Apache-2.0'],
  ['framer-motion', 'MIT'],
  ['Recharts', 'MIT'],
  ['lucide-react (아이콘)', 'ISC'],
  ['Pretendard · Paperlogy · 나눔스퀘어 네오 · Outfit (글꼴)', 'SIL OFL 1.1'],
]

export default function AccountLegalSection({ uid }) {
  return (
    <>
      <SectionTitle>약관·개인정보</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <a href={OPERATOR.privacyUrl} target="_blank" rel="noopener" style={linkStyle}>
          개인정보 처리방침 <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
        </a>
        <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>오픈소스 라이선스</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {OSS.map(([n, l]) => (
              <li key={n} className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-normal)' }}>
                {n} — {l}
              </li>
            ))}
          </ul>
          <a href={OPERATOR.licensesUrl} target="_blank" rel="noopener" style={{ ...linkStyle, fontSize: 13, minHeight: 40 }}>
            전체 고지문 보기(사용한 모든 라이브러리) <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
        <p className="text-keep-all" style={{ margin: 0, padding: '10px 0 2px', borderTop: '1px solid var(--color-line)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
          {HEALTH_DISCLAIMER}
        </p>
      </Card>
      <DeleteAccountCard uid={uid} />
    </>
  )
}

// 데이터 삭제 뒤 로그인 계정(Firebase) 삭제 — 실패하면 알리고 다시 시도하게 한다(성공처럼 보이지 않게)
async function finishAuthDeletion(setProgress, setError, setBusy) {
  try {
    setProgress('계정을 지우는 중…')
    await deleteCurrentAuthUser()
  } catch (err) {
    console.error('로그인 계정 삭제 실패:', err)
    setBusy(false)
    setProgress('')
    setError('기록은 모두 지웠지만 로그인 계정 삭제가 끝나지 않았어요. 인터넷 연결을 확인하고 다시 눌러 주세요.')
    return false
  }
  setProgress('이 기기에 남은 데이터를 지우는 중…')
  await clearLocalDataAndReload()
  return true
}

// [2026-10-31] 데이터는 지웠는데 로그인 계정 삭제가 안 끝난 상태로 다시 들어온 경우(App: userDoc.__deleted)
export function DeletedAccountScreen() {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  async function run() {
    setBusy(true)
    setError('')
    try {
      setProgress('구글 로그인을 한 번 더 확인해요…')
      await reauthWithGoogle()
    } catch (err) {
      setBusy(false)
      setProgress('')
      setError('로그인 확인에 실패했어요. 같은 구글 계정으로 다시 시도해 주세요.')
      return
    }
    await finishAuthDeletion(setProgress, setError, setBusy)
  }
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: 'calc(var(--safe-top, 0px) + 48px) 24px 32px', boxSizing: 'border-box' }}>
      <h1 className="text-keep-all" style={{ fontSize: 24, lineHeight: 1.35, margin: 0, color: 'var(--color-label-strong)' }}>탈퇴한 계정이에요</h1>
      <p className="text-keep-all" style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--color-label-normal)' }}>
        기록은 모두 지워졌고, 로그인 계정 삭제만 남았어요. 마치면 같은 구글 계정으로 새로 가입할 수 있어요.
      </p>
      {progress && <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>{progress}</p>}
      {error && <p role="alert" className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      <Button full disabled={busy} onClick={run}>{busy ? '처리 중…' : '계정 삭제 마치기'}</Button>
      <Button variant="ghost" full disabled={busy} onClick={logout}>로그아웃</Button>
    </div>
  )
}

function DeleteAccountCard({ uid }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      setProgress('구글 로그인을 한 번 더 확인해요…')
      await reauthWithGoogle()
    } catch (err) {
      setBusy(false)
      setProgress('')
      setError(err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' ? '로그인 확인 창을 닫았어요. 다시 눌러 주세요.' : '로그인 확인에 실패했어요. 같은 구글 계정으로 다시 시도해 주세요.')
      return
    }
    try {
      await deleteMyAccountData(uid, setProgress)
    } catch (err) {
      console.error('계정 데이터 삭제 실패:', err)
      setBusy(false)
      setProgress('')
      setError('일부를 지우지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요(이미 지운 것은 그대로 지워져 있어요).')
      return
    }
    await finishAuthDeletion(setProgress, setError, setBusy)
  }

  return (
    <>
      <SectionTitle>계정</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!open ? (
          <Button variant="ghost" full onClick={() => setOpen(true)}>
            계정 삭제(탈퇴)
          </Button>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>계정을 삭제할까요?</p>
            <ul className="text-keep-all" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.55, color: 'var(--color-label-normal)' }}>
              <li>운동 기록·루틴·트레이너 계획·랭킹·문의·프로필(신체 정보 포함)이 모두 지워지고 되돌릴 수 없어요.</li>
              <li>필요하면 먼저 위 "데이터"에서 운동 기록을 CSV로 받아 두세요.</li>
              <li>담당 트레이너 연결은 끝나요. PT 이용 기록(날짜·횟수)은 헬스장 정산을 위해 헬스장이 관리해요.</li>
              <li>다시 가입하면 새 계정으로 처음부터 시작하고, 헬스장 승인을 다시 받아요.</li>
            </ul>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-label-neutral)' }}>
              확인을 위해 "탈퇴"라고 적어 주세요
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={busy}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 15, fontFamily: 'inherit' }}
              />
            </label>
            {progress && <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>{progress}</p>}
            {error && <p role="alert" className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" full disabled={busy} onClick={() => { setOpen(false); setTyped(''); setError('') }}>
                취소
              </Button>
              <Button variant="danger" full disabled={busy || typed.trim() !== '탈퇴'} onClick={run}>
                {busy ? '삭제 중…' : '영구 삭제'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
