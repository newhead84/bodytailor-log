// TrainerDirectory.jsx - [2026-10-31] 회원 앱 "트레이너 소개": 재직 중인 트레이너 프로필 목록 → 상세
import React, { useCallback, useEffect, useState } from 'react'
import { BackButton, Card } from './ui'
import TrainerProfileView, { TrainerAvatar, TrainerTags } from './TrainerProfileView'
import { listTrainerProfiles } from '../storage'
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
  const wrap = { height: '100%', overflowY: 'auto', padding: '24px 20px 80px', boxSizing: 'border-box' }
  if (sel) {
    return (
      <div style={wrap}>
        <BackButton onClick={closeSel}>{direct ? '돌아가기' : '트레이너 목록'}</BackButton>
        <div style={{ marginTop: 10 }}><TrainerProfileView p={sel} /></div>
      </div>
    )
  }
  return (
    <div style={wrap}>
      <BackButton onClick={onClose}>돌아가기</BackButton>
      <h1 style={{ fontSize: 24, margin: '8px 0 6px' }}>트레이너 소개</h1>
      <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: '0 0 16px' }}>바디테일러 PT&amp;헬스 트레이너예요. PT 상담은 헬스장 데스크에 문의해 주세요.</p>
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
