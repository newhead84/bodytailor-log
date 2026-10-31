// HowToTab.jsx
// [2026-08-05 신규] IA_변경_HOWTO탭_addendum.md 기준. 하단 네비 5탭(HOME/HOWTO/NOTE/REPORT/MY)
// 중 신설된 HOWTO 탭. 구성: ① 최상단 온보딩 가이드(사용자가 "다시 안보기"를 눌러야 사라짐,
// users/{uid}.howtoOnboardingDismissed 서버 저장) ② 부위별 운동 탐색 ③ 종목 선택 시 설명 +
// (있으면) 비교 DB 표시 ④ "내 루틴에 추가" 버튼(원클릭 즉시 추가, quickAddExerciseToRoutine).
// 근육역할/그립옵션/설명/비교 데이터는 모두 utils/exerciseLibrary.js에 이미 반영돼 있음
// (EXERCISE_DB_DESIGN_v2_1_통합본.md 143개 기준, 2026-08-05 세션에서 선반영).
import React, { useEffect, useMemo, useState } from 'react'
import { HOWTO_ONBOARDING_TEXT } from '../utils/howtoText'
import { Search, ChevronRight, X, Lightbulb, Info } from 'lucide-react'
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
  getExerciseAliases,
  getExerciseDescription,
  getComparisonGroupForExercise,
  getGripOptionNotes,
} from '../utils/exerciseLibrary'
import { updateUserProfile, quickAddExerciseToRoutine } from '../storage'
import ExerciseVideoLink from './ExerciseVideoLink'
import { StretchGuide } from './StretchGuide'
import TrainerStrip from './TrainerStrip'
import ExerciseGuideSections from './ExerciseGuideSections'
import { getEquipment, isMoreGuidesLoaded } from '../utils/exerciseGuides'
import { HEALTH_DISCLAIMER } from '../utils/legal'
import { useGuideOverrides, mergeGuide } from '../utils/guideOverrides'
import GuideEditor from './GuideEditor'
import { Pencil } from 'lucide-react'

const MUSCLE_ROLE_LABELS = [
  { key: 'primary', label: '주동근' },
  { key: 'synergist', label: '보조근' },
  { key: 'stabilizer', label: '안정근' },
  { key: 'antagonist', label: '길항근' },
]

// [2026-08-06 신규] 배너 문구를 상수로 분리했다. 이 배너는 "다시 안 보기"를 누르면
// users/{uid}.howtoOnboardingDismissed=true로 저장되어 실제 계정에서는 다시 볼 방법이
// 없는데, MY탭 관리자용 "온보딩 화면 미리보기"(Onboarding.jsx previewMode)에서도 같은
// 문구를 그대로 재사용해 관리자가 언제든 확인할 수 있게 한다.
// [2026-10-27 W0] 문구 상수는 utils/howtoText.js로 이동(HowToTab 지연 로드 청크 분리를 위해).

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
    // [2026-10-28 리디자인] 강조 테두리·틴트 배경 대신 무채색 안내 카드 + 정보 아이콘
    <Card style={{ marginBottom: 20, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-line)' }}>
      <p className="text-keep-all" style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: 'var(--color-label-strong)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={16} strokeWidth={1.8} style={{ color: 'var(--color-primary-normal)' }} />
        {HOWTO_ONBOARDING_TEXT.title}
      </p>
      <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--color-label-neutral)' }}>
        {HOWTO_ONBOARDING_TEXT.body}
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

function ExerciseDetail({ uid, name, routineTemplates, onBack, onAdded, onOpenExercise, editor }) {
  const atom = getExerciseAtom(name)
  // [2026-10-31] 구조화 가이드 + 트레이너 수정본 병합 + 기구 태그(전 종목)
  const overrides = useGuideOverrides()
  const guide = mergeGuide(name, overrides[name])
  const [editing, setEditing] = useState(false)
  const equipment = getEquipment(name, atom)
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

  if (editing && editor) {
    return <GuideEditor name={name} guide={guide} hasOverride={!!overrides[name]} editor={editor} allNames={ALL_EXERCISE_NAMES} onClose={() => setEditing(false)} />
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
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: `${color}22`, color }}>
          {atom}
        </span>
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-elevated)', color: 'var(--color-label-neutral)' }}>
          {equipment}
        </span>
        {guide?.level && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-elevated)', color: 'var(--color-label-neutral)' }}>
            {guide.level}
          </span>
        )}
        {gripOptions && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-elevated)', color: 'var(--color-label-neutral)' }}>
            그립 {gripOptions.length}종
          </span>
        )}
      </div>

      {/* [2026-10-28] GIF 이미지 삭제 → YouTube 영상 검색 링크 */}
      <div style={{ marginBottom: 14 }}>
        <ExerciseVideoLink name={name} />
      </div>

      {desc && (
        <Card style={{ marginBottom: 14 }}>
          <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
            {desc.summary}
          </p>
          {!guide && (
            <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
              {desc.howTo}
            </p>
          )}
          {desc.tip && (
            <p className="text-keep-all" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--color-label-normal)', display: 'flex', gap: 6 }}>
              {/* [2026-10-28 리디자인] 이모지 → 라인 아이콘 */}
              <Lightbulb size={15} strokeWidth={1.8} style={{ color: 'var(--color-primary-normal)', flexShrink: 0, marginTop: 1 }} />
              <span>{desc.tip}</span>
            </p>
          )}
        </Card>
      )}

      {guide?.gymNote && (
        <Card style={{ marginBottom: 14, border: '1px solid var(--color-primary-normal)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 800, color: 'var(--color-primary-strong)' }}>바디테일러 메모</p>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{guide.gymNote}</p>
        </Card>
      )}
      <ExerciseGuideSections guide={guide} onOpenExercise={onOpenExercise} />
      {guide?.editedBy && (
        <p style={{ margin: '-6px 0 14px', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>{guide.editedBy} 트레이너가 다듬은 가이드예요.</p>
      )}
      {editor && isMoreGuidesLoaded() && (
        <button type="button" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-strong)' }}>
          <Pencil size={14} strokeWidth={2} />가이드 수정 (트레이너)
        </button>
      )}

      {gripOptions && (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>그립 옵션</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gripOptions.map((g) => (
              <span key={g} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-elevated)' }}>
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
      {/* [2026-10-31] 건강 정보 면책 */}
      <p className="text-keep-all" style={{ margin: '20px 0 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--color-label-neutral)' }}>{HEALTH_DISCLAIMER}</p>
    </div>
  )
}

export default function HowToTab({ uid, userDoc, routineTemplates, onProfileUpdated, onRoutineUpdated, scrollContainerRef, onShowTrainerDirectory }) {
  const [dismissed, setDismissed] = useState(!!userDoc?.howtoOnboardingDismissed)
  const [selectedAtom, setSelectedAtom] = useState(BODY_PART_ATOMS[0])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [query, setQuery] = useState('')
  // [2026-10-30] 상단 전환: 운동 둘러보기 / 스트레칭
  const [view, setView] = useState('exercise')

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
      const aliases = getExerciseAliases(name)
      return aliases.some((a) => a.toLowerCase().includes(q))
    })
  }, [query])

  const baseNames = searchResults ?? EXERCISE_LIBRARY[selectedAtom] ?? []
  // [2026-10-31] 기구 필터 — 지금 목록에 있는 기구만 칩으로(전 종목 getEquipment 태그 사용)
  const [equip, setEquip] = useState('전체')
  const equipOptions = useMemo(() => {
    const order = ['바벨', '덤벨', '머신', '스미스머신', '케이블', '원판', '맨몸', '풀업 바', '딥스 바', '밴드', '앱롤러', '유산소 기구']
    const set = new Set(baseNames.map((n) => getEquipment(n, getExerciseAtom(n))))
    const rank = (x) => (order.indexOf(x) < 0 ? 99 : order.indexOf(x))
    return [...set].sort((a, b) => rank(a) - rank(b))
  }, [baseNames])
  const activeEquip = equipOptions.includes(equip) ? equip : '전체'
  const listNames = activeEquip === '전체' ? baseNames : baseNames.filter((n) => getEquipment(n, getExerciseAtom(n)) === activeEquip)

  if (selectedExercise) {
    return (
      <div style={{ padding: '16px 16px 100px' }}>
        <ExerciseDetail
          uid={uid}
          name={selectedExercise}
          routineTemplates={routineTemplates}
          onBack={() => setSelectedExercise(null)}
          onOpenExercise={(n) => setSelectedExercise(n)}
          editor={userDoc?.role === '트레이너' || userDoc?.role === '관리자' ? { uid, name: userDoc?.signupInfo?.name || userDoc?.nickname || '' } : null}
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

      {/* [2026-10-31] 바디테일러 트레이너 소개(가로 카드) */}
      <TrainerStrip onOpen={onShowTrainerDirectory} />

      {/* [2026-10-30 신규] 운동 둘러보기 ↔ 스트레칭(불편한 부위 → 상황별) */}
      <div role="tablist" aria-label="HOWTO 보기" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, marginBottom: 16, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)' }}>
        {[
          ['exercise', '운동 둘러보기'],
          ['stretch', '스트레칭'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            style={{ minHeight: 40, borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 800, background: view === id ? 'var(--color-bg-card)' : 'transparent', color: view === id ? 'var(--color-label-strong)' : 'var(--color-label-neutral)', boxShadow: view === id ? 'var(--card-shadow)' : 'none' }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'stretch' ? (
        <StretchGuide />
      ) : (
      <>
      <SectionTitle>운동 둘러보기</SectionTitle>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-md)',
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

      {equipOptions.length > 1 && (
        <div aria-label="기구로 거르기" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '-4px 0 14px', paddingBottom: 2 }}>
          {['전체', ...equipOptions].map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={activeEquip === e}
              onClick={() => setEquip(e)}
              style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 'var(--radius-pill)', fontSize: 12.5, fontWeight: 700, border: '1px solid var(--color-line)', background: activeEquip === e ? 'var(--color-label-strong)' : 'transparent', color: activeEquip === e ? 'var(--color-bg)' : 'var(--color-label-neutral)' }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {listNames.length === 0 ? (
        <EmptyState title="검색 결과가 없어요" description="다른 이름이나 별칭으로 다시 검색해보세요." />
      ) : (
        // [2026-10-28 리디자인] 종목마다 카드 → 하나의 목록 + 헤어라인 구분
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {listNames.map((name, idx) => {
            const atom = getExerciseAtom(name)
            const alias = getExerciseAlias(name)
            const gripOptions = getGripOptions(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedExercise(name)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', borderTop: idx ? '1px solid var(--color-line)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div className="text-keep-all" style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                      {name}
                      {alias && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-label-neutral)' }}> · {alias}</span>}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2, color: 'var(--color-label-neutral)' }}>
                      {searchResults && <span style={{ color: getPartColor(atom) }}>{atom} · </span>}
                      {getEquipment(name, atom)}
                    </div>
                    {gripOptions && (
                      <div style={{ fontSize: 11, color: 'var(--color-label-neutral)', marginTop: 2 }}>
                        그립 {gripOptions.length}종 선택 가능
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} strokeWidth={1.8} color="var(--color-label-neutral)" style={{ flexShrink: 0 }} />
                </div>
              </button>
            )
          })}
        </Card>
      )}
      </>
      )}
    </div>
  )
}
