// AdminNotices.jsx - [2026-11-11] 관리자 '공지·설문'(벤치마킹: 회원에게 알림·만족도 설문). 회원 HOME 맨 위 카드로 보인다(HomeNoticeCard).
// 대상: 전체 / PT회원 / 일반회원 / 신규(가입 90일). 설문은 0~10점 + 한 줄. 푸시 알림·문자는 쓰지 않는다(무료 요금제·전화번호 원문 없음).
import React, { useEffect, useState } from 'react'
import { Chip, useConfirm } from './ui'
import { Badge, muted, selectStyle } from './adminUi'
import { adminDeleteNotice, adminListNotices, adminListSurveyResponses, adminSaveNotice, logAdmin } from '../storage'
import { fmtYmd, memberName } from '../utils/member'
import { todayStr } from '../utils/date'

export const NOTICE_TARGET = { all: '전체 회원', pt: 'PT회원', general: '일반회원', new: '신규(가입 90일)' }
const EMPTY = { kind: 'notice', title: '', body: '', target: 'all', startDate: '', endDate: '', active: true }

export default function NoticesTab({ users, admin }) {
  const confirm = useConfirm()
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [resp, setResp] = useState({}) // noticeId -> responses
  async function load() {
    try {
      setList(await adminListNotices())
    } catch (e) {
      console.error('공지 불러오기 실패:', e)
      setList([])
      setMsg('불러오지 못했어요. Firebase 규칙(공지·설문)이 게시됐는지 확인해 주세요.')
    }
  }
  useEffect(() => {
    load()
  }, [])
  async function save() {
    if (!edit.title.trim()) return setMsg('제목을 적어 주세요.')
    if (edit.startDate && edit.endDate && edit.endDate < edit.startDate) return setMsg('끝나는 날이 시작하는 날보다 빨라요.')
    setBusy(true)
    setMsg('')
    try {
      await adminSaveNotice(edit, admin)
      await logAdmin(admin, { action: 'notice', targetUid: '', targetName: '', detail: `${edit.kind === 'survey' ? '설문' : '공지'} ${edit.id ? '수정' : '등록'} · ${edit.title.slice(0, 30)} · ${NOTICE_TARGET[edit.target]}` })
      setEdit(null)
      await load()
    } catch (e) {
      console.error('공지 저장 실패:', e)
      setMsg('저장하지 못했어요. Firebase 규칙(공지·설문)이 게시됐는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  async function toggle(n) {
    try {
      await adminSaveNotice({ ...n, active: !n.active }, admin)
      await load()
    } catch (e) {
      setMsg('바꾸지 못했어요.')
    }
  }
  async function remove(n) {
    if (!(await confirm(`'${n.title}'을(를) 지울까요?${n.kind === 'survey' ? ' 받은 응답은 남아 있어요.' : ''}`, { okLabel: '지우기', cancelLabel: '취소' }))) return
    try {
      await adminDeleteNotice(n.id)
      await load()
    } catch (e) {
      setMsg('지우지 못했어요.')
    }
  }
  async function loadResp(n) {
    try {
      const r = await adminListSurveyResponses(n.id)
      setResp((m) => ({ ...m, [n.id]: r }))
    } catch (e) {
      setResp((m) => ({ ...m, [n.id]: [] }))
    }
  }
  const byUid = Object.fromEntries((users || []).map((u) => [u.uid, u]))
  const today = todayStr()
  const live = (n) => n.active && (!n.startDate || n.startDate <= today) && (!n.endDate || n.endDate >= today)
  const inp = { ...selectStyle, padding: '10px 12px', fontSize: 15.5, width: '100%', boxSizing: 'border-box' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="adm-page-intro text-keep-all" style={{ margin: 0 }}>회원 앱 HOME 맨 위에 카드로 보여요. 회원이 닫으면 그 기기에서는 다시 안 보여요. 설문은 0~10점(추천할 만한지) + 한 줄 의견을 받아요.</p>
      {msg && <p style={{ margin: 0, color: 'var(--color-warning)', fontSize: 15 }}>{msg}</p>}
      {!edit && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="adm-act primary" onClick={() => setEdit({ ...EMPTY })}>새 공지</button>
          <button type="button" className="adm-act" onClick={() => setEdit({ ...EMPTY, kind: 'survey', title: '바디테일러를 친구에게 추천하시겠어요?', body: '0점(전혀 아니다)부터 10점(꼭 추천)까지 골라 주세요. 한 줄 의견도 남겨 주시면 큰 도움이 돼요.' })}>새 만족도 설문</button>
        </div>
      )}
      {edit && (
        <div className="adm-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b style={{ fontSize: 16.5 }}>{edit.id ? '수정' : edit.kind === 'survey' ? '새 만족도 설문' : '새 공지'}</b>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={muted}>제목(40자)</span><input value={edit.title} maxLength={40} onChange={(e) => setEdit({ ...edit, title: e.target.value })} style={inp} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={muted}>내용(500자, 선택)</span><textarea value={edit.body} maxLength={500} rows={4} onChange={(e) => setEdit({ ...edit, body: e.target.value })} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={muted}>보낼 대상</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(NOTICE_TARGET).map(([k, v]) => <Chip key={k} active={edit.target === k} onClick={() => setEdit({ ...edit, target: k })} style={{ padding: '6px 12px', fontSize: 14.5 }}>{v}</Chip>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={muted}>보이기 시작(선택)</span><input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} style={selectStyle} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={muted}>끝나는 날(선택)</span><input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} style={selectStyle} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="adm-act" onClick={() => setEdit(null)}>취소</button>
            <button type="button" className="adm-act primary" disabled={busy} onClick={save}>{busy ? '저장 중…' : '저장하고 보이기'}</button>
          </div>
        </div>
      )}
      <div className="adm-panel">
        <div className="adm-panel-h"><b>공지·설문</b><span style={muted}>{list ? `${list.length}개` : ''}</span></div>
        {list === null ? <p style={{ ...muted, padding: 16, margin: 0 }}>불러오는 중…</p> : !list.length ? <p style={{ ...muted, padding: 16, margin: 0 }}>아직 없어요.</p> : list.map((n, i) => {
          const r = resp[n.id]
          const avg = r && r.length ? Math.round((r.reduce((a, x) => a + (x.score || 0), 0) / r.length) * 10) / 10 : null
          const promo = r ? r.filter((x) => x.score >= 9).length : 0
          const detr = r ? r.filter((x) => x.score <= 6).length : 0
          const nps = r && r.length ? Math.round(((promo - detr) / r.length) * 100) : null
          return (
            <div key={n.id} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--color-line)' : 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone={n.kind === 'survey' ? 'warn' : 'neutral'}>{n.kind === 'survey' ? '설문' : '공지'}</Badge>
                <b style={{ fontSize: 15.5 }}>{n.title}</b>
                {live(n) ? <Badge tone="ok">보이는 중</Badge> : <Badge>{n.active ? '기간 밖' : '숨김'}</Badge>}
                <span style={{ ...muted, fontSize: 13.5 }}>{NOTICE_TARGET[n.target]}{n.startDate || n.endDate ? ` · ${n.startDate ? fmtYmd(n.startDate) : ''}~${n.endDate ? fmtYmd(n.endDate) : ''}` : ''}</span>
              </div>
              {n.body && <p className="text-keep-all" style={{ margin: 0, fontSize: 14.5, color: 'var(--color-label-normal)', whiteSpace: 'pre-line' }}>{n.body}</p>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="adm-act" onClick={() => toggle(n)}>{n.active ? '숨기기' : '다시 보이기'}</button>
                <button type="button" className="adm-act" onClick={() => setEdit({ ...EMPTY, ...n })}>수정</button>
                <button type="button" className="adm-act" onClick={() => remove(n)}>지우기</button>
                {n.kind === 'survey' && <button type="button" className="adm-act" onClick={() => loadResp(n)}>{r ? '응답 새로 보기' : '응답 보기'}</button>}
              </div>
              {n.kind === 'survey' && r && (
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-bg-elevated)' }}>
                  {!r.length ? <span style={muted}>아직 응답이 없어요.</span> : (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: 15 }}>응답 <b className="bt-num">{r.length}</b> · 평균 <b className="bt-num">{avg}</b>점 · 추천 지수 <b className="bt-num">{nps}</b> <span style={{ ...muted, fontSize: 13 }}>(9–10점 비율 − 0–6점 비율)</span></p>
                      {r.filter((x) => x.comment).slice(0, 20).map((x) => (
                        <p key={x.id} className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 14 }}><b className="bt-num">{x.score}점</b> {x.comment} <span style={muted}>· {memberName(byUid[x.uid]) || '회원'}</span></p>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
