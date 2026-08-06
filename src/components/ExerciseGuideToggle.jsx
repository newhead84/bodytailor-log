// ExerciseGuideToggle.jsx
// [2026-08-06 신규] 2026-08-02에 "동작 가이드 이미지 연동 전면 삭제"로 함께 사라졌던
// "종목 Chip 롱프레스 → 이미지 토글" 동작을, 이번엔 이미지뿐 아니라 설명(summary/howTo)+팁까지
// 함께 보여주도록 복원한 공용 래퍼. WorkoutInput.jsx(NOTE탭 종목카드)와 RoutineSetup.jsx
// (MY탭 루틴 편집 화면) 양쪽에서 공용으로 쓴다.
//
// 동작 규칙(과거 2026-07-31 수정 이력 그대로 유지):
//  - 롱프레스(500ms, 포인터 이벤트라 터치/마우스 공통 지원) → 패널이 열림
//  - 열려 있는 상태에서 "짧게" 재탭 → 패널만 닫힘, 선택(active) 상태는 그대로 유지됨
//  - 롱프레스를 다시 해야만 닫히는 방식이 아님(짧은 탭으로 닫혀야 함)
//  - 롱프레스로 막 열린 직후 뒤따라오는 click 이벤트는 선택 토글이 발동하지 않도록 1회 무시
//  - 롱프레스 중 텍스트 선택/iOS 복사·공유 콜아웃 메뉴가 뜨지 않도록 방지
//
// 사용법: children을 렌더 프롭으로 받아, 실제 트리거 요소(Chip 등)에 guideProps를 그대로
// 펼쳐(spread) 붙여야 한다. 트리거의 onClick(선택 토글)은 그대로 별도로 넘기면 되고,
// guideProps에는 onClick이 없으므로 짧은 탭 시 선택 토글 동작은 건드리지 않는다.
import React, { useRef, useState } from 'react'
import { Card } from './ui'
import { getExerciseDescription, getExerciseAtom, getPartColor } from '../utils/exerciseLibrary'
import ExerciseGuideImage from './ExerciseGuideImage'

const LONG_PRESS_MS = 500

// 트리거 요소(Chip, 종목명 span 등)에 그대로 펼쳐 붙일 이벤트 핸들러 묶음 + open 상태를 반환하는
// 공용 훅. 레이아웃이 서로 다른 두 곳(RoutineSetup.jsx의 flex-wrap 칩 목록, WorkoutInput.jsx의
// 종목 카드 헤더 flex row)에서 패널을 서로 다른 위치에 렌더링해야 해서, 컴포넌트가 아닌 훅으로
// 분리해 각자 원하는 자리에 <ExerciseGuidePanel name={name} />을 직접 배치할 수 있게 했다.
export function useExerciseGuidePress() {
  const [open, setOpen] = useState(false)
  const timerRef = useRef(null)
  const suppressNextClickRef = useRef(false)

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handlePointerDown() {
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setOpen(true)
      suppressNextClickRef.current = true
    }, LONG_PRESS_MS)
  }

  function handlePointerRelease() {
    clearTimer()
  }

  // 캡처 단계에서 먼저 가로채, 필요한 경우 뒤따르는(버블 단계) onClick(선택 토글)을 막는다.
  function handleClickCapture(e) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  function handleContextMenu(e) {
    e.preventDefault()
  }

  const guideProps = {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerRelease,
    onPointerLeave: handlePointerRelease,
    onPointerCancel: handlePointerRelease,
    onContextMenu: handleContextMenu,
    onClickCapture: handleClickCapture,
    style: { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' },
  }

  return { open, guideProps }
}

// flex-wrap 칩 목록처럼, 트리거 바로 뒤에 패널을 놓아도 레이아웃이 흐트러지지 않는 곳에서 쓰는
// 편의 래퍼(RoutineSetup.jsx의 파트 편집 화면에서 사용).
export default function ExerciseGuideToggle({ name, children }) {
  const { open, guideProps } = useExerciseGuidePress()
  return (
    <>
      {children(guideProps)}
      {open && <ExerciseGuidePanel name={name} />}
    </>
  )
}

export function ExerciseGuidePanel({ name }) {
  const desc = getExerciseDescription(name)
  const atom = getExerciseAtom(name)
  const color = getPartColor(atom)
  return (
    <Card
      style={{
        width: '100%',
        flexBasis: '100%',
        marginTop: -2,
        marginBottom: 4,
        padding: 0,
        overflow: 'hidden',
        border: `1px solid ${color}55`,
      }}
    >
      <ExerciseGuideImage name={name} />
      {desc && (
        <div style={{ padding: '12px 14px' }}>
          <p
            className="text-keep-all"
            style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}
          >
            {desc.summary}
          </p>
          <p
            className="text-keep-all"
            style={{ margin: desc.tip ? '0 0 8px' : 0, fontSize: 12, lineHeight: 1.6, color: 'var(--color-label-normal)' }}
          >
            {desc.howTo}
          </p>
          {desc.tip && (
            <p
              className="text-keep-all"
              style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-primary-normal)' }}
            >
              💡 {desc.tip}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
