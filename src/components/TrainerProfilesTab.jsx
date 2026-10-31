// TrainerProfilesTab.jsx - [2026-10-31] 관리자 대시보드 "트레이너 프로필"
//  - 프로필(사진·직함·전문 분야·경력·자격·소개·인스타) 추가·수정·순서, 트레이너 앱 계정 연결
//  - 퇴사 처리: 앱 소개에서 숨김(기록 유지, 재직으로 되돌리기 가능) + 담당 회원을 다른 트레이너로 옮기거나 연결 해제 + 계정 역할 정리
import React, { useEffect, useState } from 'react'
import { Button, Card, Chip, useConfirm } from './ui'
import TrainerProfileView, { TrainerAvatar, TrainerTags } from './TrainerProfileView'
import { listTrainerProfiles, adminSaveTrainerProfile, adminDeleteTrainerProfile, adminConnect, endConnection, adminUpdateMember } from '../storage'
import { DEFAULT_TRAINER_PROFILES, resizePhoto, splitLines, splitTags, photoList, MAX_TRAINER_PHOTOS } from '../utils/trainerProfile'
import { todayStr } from '../utils/date'

const field = { padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }
const nameOf = (u) => u?.signupInfo?.name || u?.nickname || '(이름 없음)'

export default function TrainerProfilesTab({ users, conns, adminUid, onChanged }) {
  const confirm = useConfirm()
  const [list, setList] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | profile
  const [leaving, setLeaving] = useState(null) // 퇴사 처리 중인 프로필
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    try {
      setList(await listTrainerProfiles())
    } catch (err) {
      console.error('트레이너 프로필 불러오기 실패:', err)
      setList([])
    }
  }
  useEffect(() => {
    load()
  }, [])
  async function fail(err, what) {
    console.error(what, err)
    await confirm(`${what}에 실패했어요. ${err?.message?.includes('사진') ? err.message : '관리자 계정·Firebase 규칙 게시를 확인해 주세요.'}`, { okLabel: '확인', cancelLabel: '닫기' })
  }
  const trainerAccounts = users.filter((u) => u.role === '트레이너')
  const active = (list || []).filter((p) => p.active !== false)
  const left = (list || []).filter((p) => p.active === false)

  async function seed() {
    setBusy(true)
    try {
      for (const [i, p] of DEFAULT_TRAINER_PROFILES.entries()) await adminSaveTrainerProfile({ hours: '', instagram: '', ...p, order: i, active: true })
      await load()
    } catch (err) {
      await fail(err, '기본 프로필 등록')
    } finally {
      setBusy(false)
    }
  }
  async function move(p, dir) {
    const idx = active.findIndex((x) => x.id === p.id)
    const other = active[idx + dir]
    if (!other) return
    setBusy(true)
    try {
      await adminSaveTrainerProfile({ id: p.id, order: idx + dir })
      await adminSaveTrainerProfile({ id: other.id, order: idx })
      // 나머지도 0..n으로 정리
      await Promise.all(active.map((x, i) => (x.id !== p.id && x.id !== other.id && Number(x.order) !== i ? adminSaveTrainerProfile({ id: x.id, order: i }) : null)))
      await load()
    } catch (err) {
      await fail(err, '순서 변경')
    } finally {
      setBusy(false)
    }
  }
  async function rejoin(p) {
    if (!(await confirm(`${p.name} 트레이너를 다시 재직으로 바꿀까요? 앱 트레이너 소개에 다시 보여요.`, { okLabel: '재직으로', cancelLabel: '취소' }))) return
    try {
      await adminSaveTrainerProfile({ id: p.id, active: true, leftAt: '', order: active.length })
      await load()
    } catch (err) {
      await fail(err, '재직 변경')
    }
  }
  async function remove(p) {
    if (!(await confirm(`${p.name} 프로필을 완전히 삭제할까요? 되돌릴 수 없어요. 퇴사라면 '퇴사 처리'를 쓰면 기록이 남아요.`, { okLabel: '삭제', cancelLabel: '취소' }))) return
    try {
      await adminDeleteTrainerProfile(p.id)
      await load()
    } catch (err) {
      await fail(err, '삭제')
    }
  }

  if (list === null) return <p style={{ color: 'var(--color-label-neutral)', fontSize: 14 }}>불러오는 중…</p>
  if (editing) {
    return (
      <ProfileForm
        p={editing === 'new' ? null : editing}
        trainerAccounts={trainerAccounts}
        usedUids={(list || []).filter((x) => x.linkedUid && x.id !== editing?.id).map((x) => x.linkedUid)}
        onCancel={() => setEditing(null)}
        onSave={async (data) => {
          try {
            await adminSaveTrainerProfile(editing === 'new' ? { ...data, order: active.length, active: true } : { id: editing.id, ...data })
            setEditing(null)
            await load()
          } catch (err) {
            await fail(err, '프로필 저장')
          }
        }}
      />
    )
  }
  if (leaving) {
    return (
      <LeavePanel
        p={leaving}
        users={users}
        conns={conns}
        profiles={active}
        onCancel={() => setLeaving(null)}
        onDone={async ({ moveTo, demote }) => {
          setBusy(true)
          try {
            const mine = leaving.linkedUid ? conns.filter((c) => c.status === 'active' && c.trainerUid === leaving.linkedUid) : []
            const target = moveTo && users.find((u) => u.uid === moveTo)
            for (const c of mine) {
              const m = users.find((u) => u.uid === c.memberUid)
              if (target && m) await adminConnect(m, target, adminUid)
              else await endConnection(c.id, adminUid)
            }
            if (demote && leaving.linkedUid) await adminUpdateMember(leaving.linkedUid, { role: '일반회원' }, adminUid)
            await adminSaveTrainerProfile({ id: leaving.id, active: false, leftAt: todayStr() })
            setLeaving(null)
            await load()
            await onChanged?.()
          } catch (err) {
            await fail(err, '퇴사 처리')
          } finally {
            setBusy(false)
          }
        }}
      />
    )
  }
  if (preview) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setPreview(null)} style={{ marginBottom: 12 }}>← 목록으로</Button>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>회원 앱에서 이렇게 보여요.</p>
        <Card style={{ maxWidth: 420 }}><TrainerProfileView p={preview} /></Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="text-keep-all" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
        회원 앱 MY의 "트레이너 소개"와 담당 트레이너 카드에 보이는 프로필이에요. 순서는 화살표로 바꿔요. 트레이너 앱 계정을 연결하면 담당 회원 화면에 이 프로필이 나와요.
      </p>
      {list.length === 0 && (
        <Card>
          <p style={{ margin: 0, fontSize: 14 }}>아직 프로필이 없어요.</p>
          <Button disabled={busy} onClick={seed} style={{ marginTop: 10 }}>기본 프로필 3명 등록 ({DEFAULT_TRAINER_PROFILES.map((p) => p.name).join(' · ')})</Button>
        </Card>
      )}
      {active.map((p, i) => {
        const acct = p.linkedUid && users.find((u) => u.uid === p.linkedUid)
        const cnt = p.linkedUid ? conns.filter((c) => c.status === 'active' && c.trainerUid === p.linkedUid).length : 0
        return (
          <Card key={p.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <TrainerAvatar p={p} size={56} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800 }}>{p.name} <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-label-neutral)' }}>{p.title}</span></p>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: acct ? 'var(--color-label-normal)' : 'var(--color-warning)' }}>
                  {acct ? `앱 계정: ${nameOf(acct)} · 담당 회원 ${cnt}명` : '앱 계정 연결 안 됨'}
                  {!photoList(p).length || !p.intro ? <span style={{ color: 'var(--color-warning)' }}> · {[!photoList(p).length && '사진', !p.intro && '소개'].filter(Boolean).join('·')} 비어 있음</span> : null}
                </p>
                <TrainerTags list={p.specialties} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              <Chip onClick={() => setEditing(p)} style={{ padding: '6px 12px', fontSize: 13 }}>수정</Chip>
              <Chip onClick={() => setPreview(p)} style={{ padding: '6px 12px', fontSize: 13 }}>앱 화면 보기</Chip>
              <Chip onClick={() => !busy && move(p, -1)} style={{ padding: '6px 12px', fontSize: 13, opacity: i === 0 ? 0.4 : 1 }} aria-label="위로">↑</Chip>
              <Chip onClick={() => !busy && move(p, 1)} style={{ padding: '6px 12px', fontSize: 13, opacity: i === active.length - 1 ? 0.4 : 1 }} aria-label="아래로">↓</Chip>
              <Chip onClick={() => setLeaving(p)} style={{ padding: '6px 12px', fontSize: 13, color: 'var(--color-danger)' }}>퇴사 처리</Chip>
            </div>
          </Card>
        )
      })}
      <Button variant="ghost" onClick={() => setEditing('new')}>+ 트레이너 추가</Button>
      {left.length > 0 && (
        <>
          <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 700 }}>퇴사 <span className="bt-num">{left.length}</span>명 <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>(앱에 안 보여요)</span></p>
          {left.map((p) => (
            <Card key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85 }}>
              <TrainerAvatar p={p} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{p.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{p.leftAt ? `${p.leftAt.replace(/-/g, '.')} 퇴사` : '퇴사'}</p>
              </div>
              <Chip onClick={() => rejoin(p)} style={{ padding: '6px 12px', fontSize: 13 }}>재직으로</Chip>
              <Chip onClick={() => remove(p)} style={{ padding: '6px 12px', fontSize: 13, color: 'var(--color-danger)' }}>삭제</Chip>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

function ProfileForm({ p, trainerAccounts, usedUids, onCancel, onSave }) {
  const [f, setF] = useState({
    name: p?.name || '',
    title: p?.title || '트레이너',
    photos: photoList(p),
    hours: p?.hours || '',
    specialties: (p?.specialties || []).join(', '),
    career: (p?.career || []).join('\n'),
    certs: (p?.certs || []).join('\n'),
    intro: p?.intro || '',
    instagram: p?.instagram || '',
    linkedUid: p?.linkedUid || '',
  })
  const [photoMsg, setPhotoMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoMsg('사진 줄이는 중…')
    try {
      const url = await resizePhoto(file, 720)
      setF((x) => ({ ...x, photos: [...x.photos, url].slice(0, MAX_TRAINER_PHOTOS) }))
      setPhotoMsg('')
    } catch (err) {
      setPhotoMsg(err?.message || '사진을 읽지 못했어요.')
    }
  }
  const data = {
    name: f.name.trim().slice(0, 30),
    title: f.title.trim().slice(0, 30),
    photos: f.photos,
    photo: '',
    avatar: f.photos[0] && f.photos[0] === photoList(p)[0] ? p?.avatar || '' : '',
    hours: f.hours.trim().slice(0, 40),
    specialties: splitTags(f.specialties),
    career: splitLines(f.career),
    certs: splitLines(f.certs),
    intro: f.intro.trim().slice(0, 1000),
    instagram: f.instagram.trim().slice(0, 120),
    linkedUid: f.linkedUid || '',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
      <Card>
        <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>{p ? `${p.name} 프로필 수정` : '트레이너 추가'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>사진 (최대 {MAX_TRAINER_PHOTOS}장, 첫 장이 대표·동그란 아이콘)</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {f.photos.map((src, i) => (
                <div key={i} style={{ width: 84 }}>
                  <img src={src} alt="" style={{ width: 84, height: 104, objectFit: 'cover', objectPosition: 'center 20%', borderRadius: 10, display: 'block', outline: i === 0 ? '2px solid var(--color-primary-normal)' : 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {i > 0 ? <button type="button" onClick={() => setF((x) => ({ ...x, photos: [x.photos[i], ...x.photos.filter((_, j) => j !== i)] }))} style={{ fontSize: 11.5, color: 'var(--color-primary-strong)', fontWeight: 700 }}>대표로</button> : <span style={{ fontSize: 11.5, fontWeight: 700 }}>대표</span>}
                    <button type="button" onClick={() => setF((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))} style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>빼기</button>
                  </div>
                </div>
              ))}
              {f.photos.length < MAX_TRAINER_PHOTOS && (
                <label style={{ cursor: 'pointer', width: 84, height: 104, borderRadius: 10, border: '1px dashed var(--color-line-strong, var(--color-line))', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)', textAlign: 'center' }}>
                  <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
                  + 사진
                </label>
              )}
            </div>
          </div>
          {photoMsg && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-warning)' }}>{photoMsg}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={lab}>이름 (필수)<input value={f.name} onChange={set('name')} style={field} /></label>
            <label style={lab}>직함<input value={f.title} onChange={set('title')} placeholder="예: 대표 트레이너" style={field} /></label>
          </div>
          <label style={lab}>전문 분야 (쉼표로 구분, 8개까지)<input value={f.specialties} onChange={set('specialties')} placeholder="예: 체형 교정, 다이어트, 근비대" style={field} /></label>
          <label style={lab}>소개 글<textarea value={f.intro} onChange={set('intro')} rows={5} style={{ ...field, resize: 'vertical' }} /></label>
          <label style={lab}>경력 (한 줄에 하나)<textarea value={f.career} onChange={set('career')} rows={4} style={{ ...field, resize: 'vertical' }} /></label>
          <label style={lab}>자격·수상 (한 줄에 하나)<textarea value={f.certs} onChange={set('certs')} rows={4} style={{ ...field, resize: 'vertical' }} /></label>
          <label style={lab}>레슨 가능 시간 (선택)<input value={f.hours} onChange={set('hours')} placeholder="예: 07:00 ~ 15:00" style={field} /></label>
          <label style={lab}>인스타그램 (아이디 또는 주소, 선택)<input value={f.instagram} onChange={set('instagram')} placeholder="@아이디" style={field} /></label>
          <label style={lab}>
            트레이너 앱 계정 연결
            <select value={f.linkedUid} onChange={set('linkedUid')} style={field}>
              <option value="">연결 안 함</option>
              {trainerAccounts.map((u) => (
                <option key={u.uid} value={u.uid} disabled={usedUids.includes(u.uid)}>{nameOf(u)}{u.signupInfo?.phoneLast4 ? ` · ${u.signupInfo.phoneLast4}` : ''}{usedUids.includes(u.uid) ? ' (다른 프로필에 연결됨)' : ''}</option>
              ))}
            </select>
            <span style={{ fontSize: 12 }}>목록에 없으면 '회원' 탭에서 그 계정 역할을 '트레이너'로 바꿔 주세요.</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button variant="ghost" onClick={onCancel}>취소</Button>
          <Button
            disabled={!data.name || saving}
            onClick={async () => {
              setSaving(true)
              await onSave(data)
              setSaving(false)
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </Card>
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>회원 앱 미리보기</p>
        <Card><TrainerProfileView p={{ ...data, name: data.name || '이름' }} /></Card>
      </div>
    </div>
  )
}

function LeavePanel({ p, users, conns, profiles, onCancel, onDone }) {
  const mine = p.linkedUid ? conns.filter((c) => c.status === 'active' && c.trainerUid === p.linkedUid) : []
  const others = profiles.filter((x) => x.id !== p.id && x.linkedUid && users.some((u) => u.uid === x.linkedUid && u.role === '트레이너'))
  const [moveTo, setMoveTo] = useState('')
  const [demote, setDemote] = useState(!!p.linkedUid)
  const [saving, setSaving] = useState(false)
  return (
    <Card style={{ maxWidth: 560 }}>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{p.name} 트레이너 퇴사 처리</p>
      <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
        앱 트레이너 소개에서 숨기고 프로필은 '퇴사' 목록에 남겨요(다시 재직으로 되돌릴 수 있어요). 회원들의 운동 기록·트레이너가 보낸 계획은 그대로 남아요.
      </p>
      <div style={{ marginTop: 14 }}>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>담당 회원 <span className="bt-num">{mine.length}</span>명</p>
        {mine.length > 0 ? (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-label-neutral)' }}>{mine.map((c) => c.memberName).join(', ')}</p>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={field}>
              <option value="">연결 해제 (담당 트레이너 없음)</option>
              {others.map((x) => <option key={x.id} value={x.linkedUid}>{x.name} 트레이너에게 옮기기</option>)}
            </select>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>{p.linkedUid ? '담당 회원이 없어요.' : '앱 계정이 연결되지 않아 담당 회원이 없어요.'}</p>
        )}
      </div>
      {p.linkedUid && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 14 }}>
          <input type="checkbox" checked={demote} onChange={(e) => setDemote(e.target.checked)} />
          앱 계정 역할을 '일반회원'으로 바꾸기 (회원 기록 열람·계획 보내기 권한 해제)
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel}>취소</Button>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            await onDone({ moveTo, demote })
            setSaving(false)
          }}
        >
          퇴사 처리
        </Button>
      </div>
    </Card>
  )
}
