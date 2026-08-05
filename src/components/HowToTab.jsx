// HowToTab.jsx
// [2026-08-05 신규] IA_변경_HOWTO탭_addendum.md 기준. 하단 네비 5탭(HOME/HOWTO/NOTE/REPORT/MY)
// 중 신설된 HOWTO 탭. 구성: ① 최상단 온보딩 가이드(사용자가 "다시 안보기"를 눌러야 사라짐,
// users/{uid}.howtoOnboardingDismissed 서버 저장) ② 부위별 운동 탐색 ③ 종목 선택 시 설명 +
// (있으면) 비교 DB 표시 ④ "내 루틴에 추가" 버튼(원클릭 즉시 추가, quickAddExerciseToRoutine).
// 근육역할/그립옵션/설명/비교 데이터는 모두 utils/exerciseLibrary.js에 이미 반영돼 있음
// (EXERCISE_DB_DESIGN_v2_1_통합본.md 143개 기준, 2026-08-05 세션에서 선반영).
import React, { useEffect, useMemo, useState } from 'react'
import { Search, ChevronRight, X } from 'lucide-react'
import { Card, SectionTitle, Chip, Button, EmptyState } from './ui'
import {
  BODY_PART_ATOMS,
  EXERCISE_LIBRARY,
  ALL_EXERCISE_NAMES,
  getPartColor,
  getExerciseAtom,
  getMuscleRoles,
  getGripOptions,
  getExerciseAlias,
  getExerciseDescription,
  getComparisonGroupForExercise,
  getGripOptionNotes,
} from '../utils/exerciseLibrary'
import { updateUserProfile, quickAddExerciseToRoutine } from '../storage'
import ExerciseGuideImage from './ExerciseGuideImage'

const MUSCLE_ROLE_LABELS = [
  { key: 'primary', label: '주동근' },
  { key: 'synergist', label: '보조근' },
  { key: 'stabilizer', label: '안정근' },
  { key: 'antagonist', label: '길항근' },
]

function OnboardingBanner({ uid, onDismissed }) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismiss() {
    setDismissing(true)
    try {
      await updateUserProfile(uid, { howtoOnboardingDismissed: true })
      onDismissed?.()
    } finally {
      setDismissing(false)
    }
  }

  return (
    <Card style={{ marginBottom: 20, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-normal)' }}>
      <p className="text-keep-all" style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: 'var(--color-label-strong)' }}>
        HOWTO 탭 사용법
      </p>
      <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--color-label-neutral)' }}>
        부위를 골라 운동을 살펴보고, 설명과 비슷한 운동 비교를 확인해보세요. 마음에 드는
        종목은 "내 루틴에 추가" 버튼 한 번으로 바로 NOTE 탭에서 쓸 수 있게 담을 수 있어요.
      </p>
      <Button variant="ghost" onClick={handleDismiss} disabled={dismissing} style={{ fontSize: 13, padding: '8px 14px' }}>
        {dismissing ? '처리 중…' : '다시 안 보기'}
      </Button>
    </Card>
  )
}

// [2026-08-05 수정] 이전에는 헤더 셀에 whiteSpace:nowrap을 걸고 overflowX:auto로 가로
// 스크롤을 허용했는데, 비교군이 3~4개(+구분 열)면 화면 폭을 넘겨 스크롤이 꼭 필요했다.
// table-layout:fixed + width:100%로 폭을 화면 안에 강제로 맞추고, 헤더 nowrap을 없애
// 길면 자동 줄바꿈되게 바꿔서 가로 스크롤 없이도 전체가 한 화면에 들어오게 했다.
// "구분" 열은 폭을 좁게 고정하고 나머지는 비교군 개수만큼 균등 분배한다. 요청에 따라
// 헤더/본문 셀 모두 가운데 정렬로 변경.
function ComparisonTable({ group, currentName }) {
  const memberColWidth = `${(100 - 22) / group.members.length}%`
  return (
    <div style={{ marginTop: 8 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: 11 }}>
        <colgroup>
          <col style={{ width: '22%' }} />
          {group.members.map((m) => (
            <col key={m} style={{ width: memberColWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--color-label-neutral)', borderBottom: '1px solid var(--color-line)' }}>
              구분
            </th>
            {group.members.map((m) => (
              <th
                key={m}
                className="text-keep-all"
                style={{
                  textAlign: 'center',
                  padding: '6px 4px',
                  borderBottom: '1px solid var(--color-line)',
                  color: m === currentName ? 'var(--color-primary-normal)' : 'var(--color-label-normal)',
                  fontWeight: m === currentName ? 800 : 700,
                }}
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.axes.map((axis) => (
            <tr key={axis}>
              <td className="text-keep-all" style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--color-label-neutral)', borderBottom: '1px solid var(--color-line)' }}>
                {axis}
              </td>
              {group.members.map((m) => (
                <td
                  key={m}
                  className="text-keep-all"
                  style={{
                    textAlign: 'center',
                    padding: '6px 4px',
                    borderBottom: '1px solid var(--color-line)',
                    background: m === currentName ? 'var(--color-bg-elevated)' : 'transparent',
                  }}
                >
                  {group.table[m]?.[axis] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExerciseDetail({ uid, name, routineTemplates, onBack, onAdded }) {
  const atom = getExerciseAtom(name)
  const alias = getExerciseAlias(name)
  const desc = getExerciseDescription(name)
  const gripOptions = getGripOptions(name)
  const gripOptionNotes = getGripOptionNotes(name)
  const muscleRoles = getMuscleRoles(name)
  const comparisonGroup = getComparisonGroupForExercise(name)
  const color = getPartColor(atom)
  const [adding, setAdding] = useState(false)
  const [addResult, setAddResult] = useState(null) // { ok, alreadyAdded, templateTitle, partName, reason }

  async function handleAdd() {
    setAdding(true)
    setAddResult(null)
    try {
      const result = await quickAddExerciseToRoutine(uid, routineTemplates, name, atom)
      setAddResult(result)
      if (result.ok && !result.alreadyAdded) onAdded?.()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-label-neutral)', marginBottom: 12 }}
      >
        <ChevronRight size={16} strokeWidth={2} style={{ transform: 'rotate(180deg)' }} />
        부위별 목록으로
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 className="text-keep-all" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-label-strong)' }}>
          {name}
        </h2>
        {alias && (
          <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>({alias})</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: `${color}22`, color }}>
          {atom}
        </span>
        {gripOptions && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--color-bg-elevated)', color: 'var(--color-label-neutral)' }}>
            그립 {gripOptions.length}종
          </span>
        )}
      </div>

      <Card style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
        <ExerciseGuideImage name={name} />
      </Card>

      {desc && (
        <Card style={{ marginBottom: 14 }}>
          <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
            {desc.summary}
          </p>
          <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
            {desc.howTo}
          </p>
          {desc.tip && (
            <p className="text-keep-all" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--color-primary-normal)' }}>
              💡 {desc.tip}
            </p>
          )}
        </Card>
      )}

      {gripOptions && (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>그립 옵션</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gripOptions.map((g) => (
              <span key={g} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 999, background: 'var(--color-bg-elevated)' }}>
                {g}
              </span>
            ))}
          </div>
          {gripOptionNotes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {gripOptions.map((g) =>
                gripOptionNotes[g] ? (
                  <div key={g} style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{g}</span>
                    <span className="text-keep-all" style={{ color: 'var(--color-label-normal)', lineHeight: 1.5 }}>
                      {gripOptionNotes[g]}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          )}
          <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-label-neutral)' }}>
            NOTE 탭 기록 시 세트마다 그립을 다르게 선택할 수 있어요.
          </p>
        </Card>
      )}

      {muscleRoles && (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>근육 역할</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MUSCLE_ROLE_LABELS.map(({ key, label }) => {
              const list = muscleRoles[key]
              if (!list || list.length === 0) return null
              return (
                <div key={key} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 44, flexShrink: 0, color: 'var(--color-label-neutral)' }}>{label}</span>
                  <span className="text-keep-all" style={{ color: 'var(--color-label-normal)' }}>{list.join(', ')}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {comparisonGroup && (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>
            비슷한 운동과 비교 — {comparisonGroup.groupLabel.replace(/\s*\([a-z-]+\)\s*$/i, '')}
          </p>
          <p className="text-keep-all" style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {comparisonGroup.intro}
          </p>
          <ComparisonTable group={comparisonGroup} currentName={name} />
        </Card>
      )}

      <Button full onClick={handleAdd} disabled={adding}>
        {adding ? '추가 중…' : '내 루틴에 추가'}
      </Button>
      {addResult && (
        <p
          className="text-keep-all"
          style={{
            marginTop: 8,
            fontSize: 12,
            textAlign: 'center',
            color: addResult.ok ? 'var(--color-primary-normal)' : 'var(--color-danger)',
          }}
        >
          {addResult.ok
            ? addResult.alreadyAdded
              ? `이미 "${addResult.templateTitle}"의 "${addResult.partName}" 파트에 있어요.`
              : `"${addResult.templateTitle}"의 "${addResult.partName}" 파트에 추가했어요.`
            : addResult.reason === 'no-template'
              ? 'MY탭에서 내 루틴을 먼저 만들어주세요.'
              : '추가할 파트를 찾지 못했어요. MY탭에서 루틴 구성을 확인해주세요.'}
        </p>
      )}
    </div>
  )
}

export default function HowToTab({ uid, userDoc, routineTemplates, onProfileUpdated, onRoutineUpdated, scrollContainerRef }) {
  const [dismissed, setDismissed] = useState(!!userDoc?.howtoOnboardingDismissed)
  const [selectedAtom, setSelectedAtom] = useState(BODY_PART_ATOMS[0])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [query, setQuery] = useState('')

  // [2026-08-05 신규] 목록↔상세 전환은 탭 이동 없이 같은 스크롤 컨테이너 안에서 상태값만
  // 바꾸는 구조라, 목록을 스크롤한 채로 상세에 들어가면 이전 스크롤 위치가 그대로 남는다.
  // 상세 콘텐츠 길이(설명 길이 등)에 따라 하단 "내 루틴에 추가" 버튼이 화면 경계에 걸쳐
  // 상단이 잘려 보이는 문제의 원인이었다. 목록↔상세 전환 시마다 맨 위로 리셋한다.
  // (탭을 재탭했을 때 스크롤 맨 위로 되돌리는 App.jsx의 기존 동작과는 별개 — 그건 그대로 둔다.)
  useEffect(() => {
    scrollContainerRef?.current?.scrollTo({ top: 0 })
  }, [selectedExercise, scrollContainerRef])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return ALL_EXERCISE_NAMES.filter((name) => {
      if (name.toLowerCase().includes(q)) return true
      const alias = getExerciseAlias(name)
      return alias ? alias.toLowerCase().includes(q) : false
    })
  }, [query])

  const listNames = searchResults ?? EXERCISE_LIBRARY[selectedAtom] ?? []

  if (selectedExercise) {
    return (
      <div style={{ padding: '16px 16px 100px' }}>
        <ExerciseDetail
          uid={uid}
          name={selectedExercise}
          routineTemplates={routineTemplates}
          onBack={() => setSelectedExercise(null)}
          onAdded={onRoutineUpdated}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {!dismissed && (
        <OnboardingBanner
          uid={uid}
          onDismissed={() => {
            setDismissed(true)
            onProfileUpdated?.()
          }}
        />
      )}

      <SectionTitle>운동 둘러보기</SectionTitle>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--color-bg-elevated)',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 14,
        }}
      >
        <Search size={16} strokeWidth={1.8} color="var(--color-label-neutral)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="운동명 또는 별칭으로 검색 (예: 천국의 계단)"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--color-label-normal)' }}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="검색어 지우기">
            <X size={16} strokeWidth={2} color="var(--color-label-neutral)" />
          </button>
        )}
      </div>

      {!searchResults && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {BODY_PART_ATOMS.map((atom) => (
            <Chip key={atom} active={selectedAtom === atom} onClick={() => setSelectedAtom(atom)}>
              {atom}
            </Chip>
          ))}
        </div>
      )}

      {listNames.length === 0 ? (
        <EmptyState title="검색 결과가 없어요" description="다른 이름이나 별칭으로 다시 검색해보세요." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listNames.map((name) => {
            const atom = getExerciseAtom(name)
            const alias = getExerciseAlias(name)
            const gripOptions = getGripOptions(name)
            return (
              <Card key={name} onClick={() => setSelectedExercise(name)} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="text-keep-all" style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                      {name}
                      {alias && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-label-neutral)' }}> · {alias}</span>}
                    </div>
                    {searchResults && (
                      <div style={{ fontSize: 11, color: getPartColor(atom), marginTop: 2 }}>{atom}</div>
                    )}
                    {gripOptions && (
                      <div style={{ fontSize: 11, color: 'var(--color-label-neutral)', marginTop: 2 }}>
                        그립 {gripOptions.length}종 선택 가능
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} strokeWidth={1.8} color="var(--color-label-neutral)" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
