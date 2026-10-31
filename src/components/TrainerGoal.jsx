// TrainerGoal.jsx
// [2026-10-31 신규] 트레이너 목표 설정: 담당 트레이너가 회원 목표(운동 목표·주간 목표 일수)를 제안하거나 직접 바꾼다.
//  - TrainerGoalEditor: 트레이너 "내 회원" 화면. 제안(회원 수락 후 반영) 또는 바로 바꾸기.
//  - TrainerGoalNotice: 회원 HOME 상단. 받은 제안 수락·거절, 트레이너가 바꾼 목표 알림(확인하면 닫힘).
//  - TrainerGoalMark: 회원 MY 프로필 목표 옆 "트레이너 수정" 표시(회원이 직접 목표를 고치면 사라짐).
import React, { useState } from 'react'
import { Button, Card, Chip, useConfirm } from './ui'
import { GoalPicker } from './GoalPicker'
import { normalizeGoals, GOAL_LABELS } from '../utils/goals'
import { trainerProposeGoals, trainerCancelGoalProposal, trainerEditGoals, acceptGoalProposal, declineGoalProposal, markGoalEditSeen } from '../storage'

const DAY_OPTIONS = [2, 3, 4, 5, 6]
const fmtGoals = (goals) => {
  const list = normalizeGoals(goals)
  return list.length ? list.map((g, i) => (i < 3 && GOAL_LABELS.includes(g) ? `${'①②③'[i]} ${g}` : g)).join('  ') : '없음'
}
const fmtDate = (ts) => {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : ''
}
const small = { margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-neutral)' }

export function TrainerGoalEditor({ member, memberUid, trainer, onChanged }) {
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [goals, setGoals] = useState([])
  const [days, setDays] = useState(3)
  const [busy, setBusy] = useState(false)
  const proposal = member?.goalProposal
  function start() {
    setGoals(normalizeGoals(member?.onboarding?.goals))
    setDays(member?.weeklyTargetDays || 3)
    setOpen(true)
  }
  async function run(fn, fail) {
    setBusy(true)
    try {
      await fn()
      setOpen(false)
      await onChanged?.()
    } catch (e) {
      console.error(fail, e)
      window.alert(`${fail} 연결 상태를 확인하고 다시 시도해 주세요.`)
    } finally {
      setBusy(false)
    }
  }
  const data = { goals: normalizeGoals(goals), weeklyTargetDays: days }
  const empty = data.goals.length === 0
  if (!open) {
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
        {proposal ? (
          <>
            <p className="text-keep-all" style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700 }}>목표 제안을 보냈어요 · 회원 수락 대기</p>
            <p className="text-keep-all" style={small}>{fmtGoals(proposal.goals)} · 주 {proposal.weeklyTargetDays}일</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button variant="secondary" disabled={busy} onClick={start}>다시 정하기</Button>
              <Button variant="secondary" disabled={busy} onClick={() => run(() => trainerCancelGoalProposal(memberUid), '제안을 취소하지 못했어요.')}>제안 취소</Button>
            </div>
          </>
        ) : (
          <Button variant="secondary" onClick={start}>목표 정하기</Button>
        )}
      </div>
    )
  }
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>운동 목표</div>
      <GoalPicker goals={goals} onChange={setGoals} />
      <div style={{ fontSize: 13.5, fontWeight: 700, margin: '14px 0 6px' }}>주당 운동 목표</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DAY_OPTIONS.map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>주 {d}일</Chip>)}
      </div>
      <p className="text-keep-all" style={{ ...small, marginTop: 12 }}>제안은 회원이 수락하면 바뀌고, 바로 바꾸면 회원 화면에 트레이너가 바꿨다고 표시돼요.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Button disabled={busy || empty} onClick={() => run(() => trainerProposeGoals(memberUid, trainer, data), '제안을 보내지 못했어요.')}>회원에게 제안</Button>
        <Button
          variant="secondary"
          disabled={busy || empty}
          onClick={async () => {
            if (!(await confirm('회원 수락 없이 목표를 바로 바꿀까요? 회원 화면에 바뀌었다고 알려요.', { okLabel: '바로 바꾸기', cancelLabel: '취소' }))) return
            run(() => trainerEditGoals(memberUid, trainer, data), '목표를 바꾸지 못했어요.')
          }}
        >
          바로 바꾸기
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
      </div>
    </div>
  )
}

export function TrainerGoalNotice({ uid, userDoc, onChanged }) {
  const [busy, setBusy] = useState(false)
  const p = userDoc?.goalProposal
  const edit = userDoc?.goalByTrainer
  async function run(fn) {
    setBusy(true)
    try {
      await fn()
      await onChanged?.()
    } catch (e) {
      console.error('목표 반영 실패:', e)
      window.alert('저장하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  if (p) {
    return (
      <Card style={{ marginBottom: 20, border: '1px solid var(--color-fill-strong)' }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{p.byName || '담당'} 트레이너가 목표를 제안했어요</p>
        <div className="text-keep-all" style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.7 }}>
          <div><span style={{ color: 'var(--color-label-neutral)' }}>제안 </span><b>{fmtGoals(p.goals)} · 주 {p.weeklyTargetDays}일</b></div>
          <div style={{ color: 'var(--color-label-neutral)' }}>지금 {fmtGoals(userDoc?.onboarding?.goals)} · 주 {userDoc?.weeklyTargetDays || 3}일</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button disabled={busy} onClick={() => run(() => acceptGoalProposal(uid, p))}>수락</Button>
          <Button variant="secondary" disabled={busy} onClick={() => run(() => declineGoalProposal(uid))}>거절</Button>
        </div>
      </Card>
    )
  }
  if (edit && !edit.seen && !edit.accepted) {
    return (
      <Card style={{ marginBottom: 20 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{edit.byName || '담당'} 트레이너가 목표를 바꿨어요</p>
        <p className="text-keep-all" style={{ ...small, marginTop: 6, color: 'var(--color-label-normal)' }}>
          {fmtGoals(userDoc?.onboarding?.goals)} · 주 {userDoc?.weeklyTargetDays || 3}일
        </p>
        <p className="text-keep-all" style={{ ...small, marginTop: 2 }}>바뀐 목표로 목표 횟수·휴식을 맞춰요. MY에서 직접 고칠 수도 있어요.</p>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" disabled={busy} onClick={() => run(() => markGoalEditSeen(uid))}>확인</Button>
        </div>
      </Card>
    )
  }
  return null
}

export function TrainerGoalMark({ userDoc }) {
  const e = userDoc?.goalByTrainer
  if (!e) return null
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)' }}>
      {e.byName || '담당'} 트레이너 {e.accepted ? '제안 수락' : '수정'}{fmtDate(e.at) ? ` · ${fmtDate(e.at)}` : ''}
    </div>
  )
}
