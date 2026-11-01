// TrainerDirectory.jsx - [2026-10-31] 회원 앱 "트레이너 소개": 재직 중인 트레이너 프로필 목록 → 상세
// [2026-11-01] B33: 상세 아래 "PT 상담 신청" → 1:1 문의(type 'pt' + 트레이너 프로필 ID)로 관리자에게 전달
import React, { useCallback, useEffect, useState } from 'react'
import { ScreenHeader, Card, Button } from './ui'
import TrainerProfileView, { TrainerAvatar, TrainerTags } from './TrainerProfileView'
import { listTrainerProfiles, submitInquiry, getUserDoc } from '../storage'
import { auth } from '../firebase'
import { useBackableScreen } from '../hooks/useBackableScreen'

export default function TrainerDirectory({ initialUid = '', initialId = '', onClose }) {
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  const [direct, setDirect] = useState(false) // 특정 트레이너로 바로 열었으면 상세를 닫을 때 소개 화면 전체를 닫는다
  const closeSel = useCallback(() => {
    setSel(null)
    if (direct) onClose?.()
  }, [direct, onClose])
  useBackableScreen(!!sel, closeSel)
  useEffect(() => {
    listTrainerProfiles()
      .then((l) => {
        const act = l.filter((p) => p.active !== false)
        setList(act)
        const hit = (initialId && act.find((p) => p.id === initialId)) || (initialUid && act.find((p) => p.linkedUid === initialUid))
        if (hit) {
          setSel(hit)
          setDirect(true)
        }
      })
      .catch((err) => {
        console.error('트레이너 소개 불러오기 실패:', err)
        setList([])
      })
  }, [initialUid, initialId])
  const wrap = { height: '100%', overflowY: 'auto', padding: '0 20px 80px', boxSizing: 'border-box' }
  if (sel) {
    return (
      <div style={wrap}>
        <ScreenHeader title={sel.name ? `${sel.name} 트레이너` : '트레이너'} onBack={closeSel} backLabel={direct ? '돌아가기' : '트레이너 목록'} />
        <TrainerProfileView p={sel} />
        <PtConsult p={sel} />
      </div>
    )
  }
  return (
    <div style={wrap}>
      <ScreenHeader title="트레이너 소개" onBack={onClose} />
      <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>바디테일러 PT&amp;헬스 트레이너예요. 트레이너를 누르면 PT 상담을 신청할 수 있어요.</p>
      {list === null ? (
        <p style={{ color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : list.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>아직 등록된 트레이너 소개가 없어요.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((p) => (
            <Card key={p.id} onClick={() => setSel(p)} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <TrainerAvatar p={p} size={64} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-primary-normal)' }}>{p.title || '트레이너'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800 }}>{p.name}</p>
                <TrainerTags list={(p.specialties || []).slice(0, 3)} />
              </div>
              <span aria-hidden="true" style={{ color: 'var(--color-label-neutral)' }}>›</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// [2026-11-01] B33: PT 상담 신청(관리자 문의함에 'PT 상담'으로 보여요, 답변은 MY › 1:1 문의에서 확인)
function PtConsult({ p }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function send() {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setBusy(true)
    setMsg('')
    try {
      const me = await getUserDoc(uid).catch(() => null)
      const content = `[PT 상담 신청] ${p.name || ''} 트레이너\n${text.trim() || '상담을 받고 싶어요.'}`.slice(0, 2000)
      await submitInquiry(uid, me?.nickname || '', content, { type: 'pt', trainerId: p.id })
      setMsg('신청했어요. 답변은 MY › 1:1 문의에서 볼 수 있어요.')
      setOpen(false)
      setText('')
    } catch (err) {
      console.error('PT 상담 신청 실패:', err)
      setMsg(err?.code === 'permission-denied' ? '방금 문의를 보냈다면 1분 뒤에 다시 보내 주세요.' : '보내지 못했어요. 연결 상태를 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ marginTop: 24 }}>
      {open ? (
        <Card>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>{p.name} 트레이너 PT 상담 신청</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="원하는 요일·시간, 운동 목표 등(선택)"
            aria-label="상담 내용"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }}
          />
          <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>부상·질병 같은 건강 정보는 적지 말고 상담 때 직접 말씀해 주세요.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button disabled={busy} onClick={send}>{busy ? '보내는 중…' : '신청하기'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
          </div>
        </Card>
      ) : (
        <Button full onClick={() => { setOpen(true); setMsg('') }}>PT 상담 신청</Button>
      )}
      {msg && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>{msg}</p>}
    </div>
  )
}
