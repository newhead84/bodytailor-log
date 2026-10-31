// GuideEditor.jsx - [2026-10-31] 트레이너·관리자용 운동 가이드 수정 화면(HOWTO 종목 상세 → "가이드 수정")
// 한 줄에 하나씩 입력. 핵심 포인트는 "핵심 | 느낌", 흔한 실수는 "실수 | 이유 | 고치는 법" 형식. 저장하면 회원 앱 전체에 바로 반영.
import React, { useState } from 'react'
import { Button, Card, useConfirm } from './ui'
import { saveGuideOverride, deleteGuideOverride } from '../storage'
import { loadGuideOverrides } from '../utils/guideOverrides'
import { getExerciseGuide } from '../utils/exerciseGuides'

const field = { padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }
const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--color-label-neutral)' }
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10).map((x) => x.slice(0, 160))
const cells = (s) => s.split('|').map((x) => x.trim())

export default function GuideEditor({ name, guide, hasOverride, editor, allNames, onClose }) {
  const confirm = useConfirm()
  const g = guide || {}
  const [f, setF] = useState({
    level: g.level || '',
    setup: (g.setup || []).join('\n'),
    start: (g.start || []).join('\n'),
    move: (g.move || []).join('\n'),
    breath: g.breath || '',
    keyPoints: (g.keyPoints || []).map((k) => `${k.cue}${k.feel ? ` | ${k.feel}` : ''}`).join('\n'),
    mistakes: (g.mistakes || []).map((m) => [m.what, m.why, m.fix].filter(Boolean).join(' | ')).join('\n'),
    cautions: (g.cautions || []).join('\n'),
    alternatives: (g.alternatives || []).join(', '),
    gymNote: g.gymNote || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const alts = f.alternatives.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
  const badAlts = alts.filter((a) => !allNames.includes(a) || a === name)

  async function save() {
    if (badAlts.length) return setMsg(`대체 운동 이름을 목록과 똑같이 적어 주세요: ${badAlts.join(', ')}`)
    setSaving(true)
    setMsg('')
    try {
      await saveGuideOverride(
        name,
        {
          level: f.level,
          setup: lines(f.setup),
          start: lines(f.start),
          move: lines(f.move),
          breath: f.breath.trim().slice(0, 200),
          keyPoints: lines(f.keyPoints).map((l) => {
            const [cue, feel = ''] = cells(l)
            return { cue, feel }
          }),
          mistakes: lines(f.mistakes).map((l) => {
            const [what, why = '', fix = ''] = cells(l)
            return { what, why, fix }
          }),
          cautions: lines(f.cautions),
          alternatives: alts.slice(0, 4),
          gymNote: f.gymNote.trim().slice(0, 300),
        },
        editor
      )
      await loadGuideOverrides(true)
      onClose()
    } catch (err) {
      console.error('가이드 저장 실패:', err)
      setMsg('저장하지 못했어요. 트레이너·관리자 계정인지 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }
  async function reset() {
    if (!(await confirm(`${name} 가이드를 기본 내용으로 되돌릴까요? 고친 내용과 헬스장 메모가 지워져요.`, { okLabel: '되돌리기', cancelLabel: '취소' }))) return
    try {
      await deleteGuideOverride(name)
      await loadGuideOverrides(true)
      onClose()
    } catch (err) {
      console.error('가이드 되돌리기 실패:', err)
      setMsg('되돌리지 못했어요.')
    }
  }

  return (
    <div>
      <button type="button" onClick={onClose} style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginBottom: 12 }}>← 수정 취소</button>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{name} 가이드 수정</h2>
      <p className="text-keep-all" style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-label-neutral)', lineHeight: 1.6 }}>
        저장하면 모든 회원에게 바로 보여요. 한 줄에 하나씩 적고, 비워 두면 그 칸은 안 보여요.{!getExerciseGuide(name) && ' 이 종목은 아직 기본 가이드가 없어요.'}
      </p>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={lab}>우리 헬스장 메모 (선택 · 회원에게 맨 위에 보여요)
          <textarea rows={2} value={f.gymNote} onChange={set('gymNote')} placeholder="예: 2층 레그프레스는 등받이 3칸이 표준. 오전엔 붐벼요." style={field} />
        </label>
        <label style={lab}>난이도
          <select value={f.level} onChange={set('level')} style={field}>
            <option value="">표시 안 함</option>
            {['초급', '중급', '고급'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label style={lab}>기구 세팅<textarea rows={2} value={f.setup} onChange={set('setup')} style={field} /></label>
        <label style={lab}>시작 자세<textarea rows={3} value={f.start} onChange={set('start')} style={field} /></label>
        <label style={lab}>동작<textarea rows={3} value={f.move} onChange={set('move')} style={field} /></label>
        <label style={lab}>호흡<input value={f.breath} onChange={set('breath')} style={field} /></label>
        <label style={lab}>핵심 포인트 (한 줄에 "핵심 | 느낌")<textarea rows={3} value={f.keyPoints} onChange={set('keyPoints')} style={field} /></label>
        <label style={lab}>흔한 실수 (한 줄에 "실수 | 왜 안 좋은지 | 고치는 법")<textarea rows={4} value={f.mistakes} onChange={set('mistakes')} style={field} /></label>
        <label style={lab}>주의<textarea rows={2} value={f.cautions} onChange={set('cautions')} style={field} /></label>
        <label style={lab}>대신 할 수 있는 운동 (쉼표로 구분, 운동 목록 이름 그대로)<input value={f.alternatives} onChange={set('alternatives')} style={field} /></label>
        {msg && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button disabled={saving} onClick={save}>{saving ? '저장 중…' : '저장'}</Button>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          {hasOverride && <Button variant="ghost" onClick={reset} style={{ marginLeft: 'auto', color: 'var(--color-danger)' }}>기본으로 되돌리기</Button>}
        </div>
      </Card>
    </div>
  )
}
