// ConsentScreen.jsx - [2026-10-31 신규] 개인정보 수집·이용 동의 + 만 14세 이상 확인(법적 정비)
// 새 계정은 온보딩 전에, 기존 계정은 다음 접속 때 한 번(users.consents.version이 CONSENT_VERSION과 다르면).
// 신체 정보는 일반 개인정보와 따로 동의받는다. 랭킹 공개·건강 정보 면책도 여기서 알린다.
import React, { useState } from 'react'
import { Check, ChevronDown, ExternalLink } from 'lucide-react'
import { Button } from './ui'
import { logout } from '../firebase'
import { CONSENT_VERSION, OPERATOR, HEALTH_DISCLAIMER } from '../utils/legal'

const ITEMS = [
  {
    id: 'age14',
    label: '만 14세 이상이에요',
    detail: null,
  },
  {
    id: 'privacy',
    label: '개인정보 수집·이용에 동의해요',
    detail: [
      '수집 항목: 구글 계정 정보(이메일·이름·계정 식별값), 닉네임, 헬스장 회원 확인용 이름·휴대폰 번호(번호는 변환값과 뒤 4자리만 저장), 운동 기록, 문의 내용',
      '목적: 헬스장 회원 확인, 운동 기록·통계·랭킹 제공, 문의 답변',
      '보관: 탈퇴할 때까지(MY › 설정 › 계정 삭제로 바로 지울 수 있어요)',
    ],
  },
  {
    id: 'body',
    label: '신체 정보 수집·이용에 동의해요',
    detail: [
      '수집 항목: 성별, 나이, 몸무게, 키, 운동 목표, 주당 운동 일수',
      '목적: 목표에 맞는 반복·휴식·세트 기준, 맨몸·보조 운동 부하, BMI 계산',
      'PT 회원은 담당 트레이너가 이 정보를 볼 수 있어요(연결이 끝나면 바로 막혀요).',
      '보관: 탈퇴할 때까지',
    ],
  },
  {
    id: 'overseas',
    label: '기록이 해외 서버에 보관되는 것을 확인했어요',
    // [2026-10-31] '해외에 팔리는 느낌'이 들지 않게 이유를 먼저, 펼치지 않아도 보이게(사용자 지적)
    sub: '앱이 따로 서버를 두지 않고 구글 클라우드에 기록을 보관해서, 법에 따라 알려 드리는 거예요. 정보를 팔거나 광고에 쓰지 않아요.',
    detail: [
      '왜 해외인가요: 로그인과 기록 저장을 구글의 클라우드 서비스(Firebase)로 하는데, 이 저장소가 미국 등 해외 데이터센터에 있어요. 우리나라 법은 이것도 "국외 이전"으로 보고 알리도록 해요.',
      '누가 받나요: Google LLC(Firebase: 로그인·기록 보관), Vercel Inc.(앱 화면 전달). 두 회사는 저장과 화면 전달만 맡아요.',
      '팔거나 광고에 쓰지 않아요: 운영자는 정보를 판매하거나 마케팅·광고에 쓰지 않고, 다른 회사에 넘기지 않아요.',
      '어떻게 지키나요: 전송은 암호화되고, 본인·관리자·연결된 담당 트레이너만 볼 수 있게 접근 규칙을 걸어 둬요.',
      '언제까지: 탈퇴할 때까지(탈퇴하면 바로 지워요)',
    ],
  },
]

export default function ConsentScreen({ onAgree }) {
  const [checked, setChecked] = useState({})
  const [open, setOpen] = useState({})
  const [saving, setSaving] = useState(false)
  const [under14, setUnder14] = useState(false)
  const [error, setError] = useState('')
  const all = ITEMS.every((it) => checked[it.id])
  const toggleAll = () => setChecked(all ? {} : Object.fromEntries(ITEMS.map((it) => [it.id, true])))

  async function agree() {
    setSaving(true)
    setError('')
    try {
      await onAgree({ version: CONSENT_VERSION, agreedAt: Date.now(), age14: true, privacy: true, body: true, overseas: true })
    } catch (err) {
      console.error('동의 저장 실패:', err)
      setError('저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.')
      setSaving(false)
    }
  }

  if (under14) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: 'calc(var(--safe-top, 0px) + 48px) 24px 32px', boxSizing: 'border-box' }}>
        <h1 className="text-keep-all" style={{ fontSize: 24, lineHeight: 1.35, margin: 0, color: 'var(--color-label-strong)' }}>만 14세 이상부터 쓸 수 있어요</h1>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--color-label-normal)' }}>
          지금은 보호자 동의 절차가 없어 만 14세 미만은 가입할 수 없어요. 운동은 헬스장 트레이너와 함께해 주세요.
        </p>
        <Button full onClick={logout}>로그아웃</Button>
        <button type="button" onClick={() => setUnder14(false)} style={{ fontSize: 13, color: 'var(--color-label-neutral)', textDecoration: 'underline' }}>
          잘못 눌렀어요
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 'calc(var(--safe-top, 0px) + 36px) 22px calc(var(--safe-bottom, 0px) + 28px)', boxSizing: 'border-box' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-normal)', margin: '0 0 8px' }}>{OPERATOR.service}</p>
      <h1 className="text-keep-all" style={{ fontSize: 24, lineHeight: 1.35, margin: '0 0 8px', color: 'var(--color-label-strong)' }}>시작하기 전에 확인해 주세요</h1>
      <p className="text-keep-all" style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
        기록을 안전하게 보관하려고 필요한 것만 받아요.
      </p>

      <button
        type="button"
        onClick={toggleAll}
        aria-pressed={all}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line-strong)', background: 'var(--color-bg-elevated)', textAlign: 'left', marginBottom: 6 }}
      >
        <Box on={all} />
        <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--color-label-strong)' }}>모두 동의해요</span>
      </button>

      {ITEMS.map((it) => (
        <div key={it.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              aria-pressed={!!checked[it.id]}
              onClick={() => setChecked((c) => ({ ...c, [it.id]: !c[it.id] }))}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, minHeight: 50, padding: '6px 14px', textAlign: 'left' }}
            >
              <Box on={!!checked[it.id]} />
              <span className="text-keep-all" style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 14.5, color: 'var(--color-label-strong)' }}>
                <span>
                  <span style={{ fontWeight: 800, color: 'var(--color-primary-normal)' }}>(필수)</span> {it.label}
                </span>
                {it.sub && <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-label-neutral)' }}>{it.sub}</span>}
              </span>
            </button>
            {it.detail && (
              <button type="button" aria-expanded={!!open[it.id]} aria-label={`${it.label} 자세히`} onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)' }}>
                <ChevronDown size={18} strokeWidth={1.8} style={{ transform: open[it.id] ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
            )}
          </div>
          {it.detail && open[it.id] && (
            <ul className="bt-enter" style={{ margin: '0 0 12px', padding: '0 14px 0 50px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {it.detail.map((d) => (
                <li key={d} className="text-keep-all" style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-label-normal)' }}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div style={{ margin: '18px 0 0', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
          <b>랭킹 공개:</b> 랭킹에는 닉네임과 점수가 다른 회원에게 보여요. 닉네임은 실명이 아니어도 되고, MY에서 바꿀 수 있어요.
        </p>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
          <b>건강 안내:</b> {HEALTH_DISCLAIMER}
        </p>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
          동의하지 않으면 앱을 쓸 수 없어요. 동의는 탈퇴로 언제든 거둘 수 있어요.
        </p>
        <a href={OPERATOR.privacyUrl} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>
          개인정보 처리방침 전문 <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>

      {error && <p role="alert" className="text-keep-all" style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      <Button full disabled={!all || saving} onClick={agree} style={{ marginTop: 18 }}>
        {saving ? '저장 중…' : '동의하고 시작하기'}
      </Button>
      <button type="button" onClick={() => setUnder14(true)} style={{ display: 'block', margin: '14px auto 0', fontSize: 13, color: 'var(--color-label-neutral)', textDecoration: 'underline' }}>
        만 14세 미만이에요
      </button>
    </div>
  )
}

function Box({ on }) {
  return (
    <span
      aria-hidden="true"
      style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: on ? '1px solid var(--color-fill-strong)' : '1.5px solid var(--color-line-strong)', background: on ? 'var(--color-fill-strong)' : 'transparent', color: 'var(--color-on-fill)' }}
    >
      {on && <Check size={15} strokeWidth={3} />}
    </span>
  )
}
