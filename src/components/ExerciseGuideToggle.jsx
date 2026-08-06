// ExerciseGuideToggle.jsx
// [2026-08-02] "동작 가이드 이미지 연동 전면 삭제"로 함께 사라졌던 "종목 Chip 롱프레스 →
// 이미지 토글" 동작을, [2026-08-06] 이미지뿐 아니라 설명(summary/howTo)+팁까지 함께
// 보여주도록 복원. WorkoutInput.jsx(NOTE탭 종목카드)와 RoutineSetup.jsx(MY탭 루틴 편집
// 화면) 양쪽에서 공용으로 쓴다.
//
// [2026-08-06 (2) 재설계] 실사용 테스트 결과, 기존 "네이티브 click 이벤트 발생에 의존해
// open/close 상태를 바꾸는" 방식은 터치 환경에서 짧은 연속 탭 시 click 타이밍이 불안정해
// 짧은 재탭으로 패널이 안 닫히는 문제가 있었다(근본원인). 이번 버전은 열고/닫는 "상태
// 변경"을 click이 아니라 pointerdown→pointerup 시간차 자체로 직접 판단하도록 바꿨다.
// click 이벤트는 오직 "이 눌림으로 상태가 바뀌었을 때, 뒤이어 따라오는 click이 트리거
// 요소의 자체 onClick(선택 토글, 종목 추가 등)을 잘못 발동시키지 않도록 막는 용도"로만
// 쓰인다(상태 변경에는 더 이상 관여하지 않음).
//
// 동작 규칙:
//  - 롱프레스(500ms, 포인터 이벤트라 터치/마우스 공통 지원) → 패널이 열림
//  - 열려 있는 상태에서 다시 롱프레스(500ms) → 패널이 닫힘 (롱프레스 자체가 열기/닫기 토글)
//  - 열려 있는 상태에서 "짧게" 재탭(500ms 미만) → 패널만 닫힘, 선택(active) 상태는 그대로 유지
//  - (WorkoutInput.jsx 전용) containerRef를 넘기면, 열려 있는 동안 그 컨테이너(카드) 바깥을
//    탭했을 때도 자동으로 닫힘. containerRef를 넘기지 않으면(RoutineSetup.jsx 등) 이 동작은
//    비활성화된다.
//  - close()를 밖으로 노출 — "시작" 버튼처럼 다른 동작을 트리거하는 버튼을 눌렀을 때도
//    가이드 패널을 함께 닫고 싶은 화면에서 직접 호출할 수 있다.
//  - 롱프레스 중 텍스트 선택/iOS 복사·공유 콜아웃 메뉴가 뜨지 않도록 방지(전역 CSS로도
//    이중 방지되지만, 트리거 요소에도 명시적으로 남겨둔다)
//
// 사용법: children을 렌더 프롭으로 받아, 실제 트리거 요소(Chip 등)에 guideProps를 그대로
// 펼쳐(spread) 붙여야 한다. 트리거의 onClick(선택 토글)은 그대로 별도로 넘기면 되고,
// guideProps에는 onClick이 없으므로 짧은 탭 시 선택 토글 동작은 건드리지 않는다.
import React, { useEffect, useRef, useState } from 'react'
import { Card } from './ui'
import { getExerciseDescription, getExerciseAtom, getPartColor } from '../utils/exerciseLibrary'
import ExerciseGuideImage from './ExerciseGuideImage'

const LONG_PRESS_MS = 500

// 트리거 요소(Chip, 종목명 span 등)에 그대로 펼쳐 붙일 이벤트 핸들러 묶음 + open 상태를 반환하는
// 공용 훅. containerRef를 넘기면 그 요소 바깥을 탭했을 때도 자동으로 닫히게 할 수 있다(옵션).
export function useExerciseGuidePress(containerRef) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef(null)
  const pressWasLongRef = useRef(false)
  // 이 눌림으로 open 상태가 방금 바뀐 경우, 뒤이어 오는 click 1회를 무시한다(선택 토글 등
  // 트리거의 자체 onClick 오발동 방지).
  const consumeNextClickRef = useRef(false)

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handlePointerDown() {
    clearTimer()
    pressWasLongRef.current = false
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      pressWasLongRef.current = true
      // 롱프레스 확정: 열려 있으면 닫고, 닫혀 있으면 연다(다시 롱프레스하면 닫히는 동작).
      setOpen((prev) => !prev)
      consumeNextClickRef.current = true
    }, LONG_PRESS_MS)
  }

  function handlePointerRelease() {
    clearTimer()
    // 타이머가 발동하기 전에 뗀 경우 = 짧은 탭. 열려 있었다면 이 짧은 탭으로 닫는다.
    // click 이벤트를 기다리지 않고 여기서 즉시 상태를 바꾸는 것이 핵심(기존 버그 수정).
    if (!pressWasLongRef.current && open) {
      setOpen(false)
      consumeNextClickRef.current = true
    }
  }

  function handleClickCapture(e) {
    if (consumeNextClickRef.current) {
      consumeNextClickRef.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }

  function handleContextMenu(e) {
    e.preventDefault()
  }

  function close() {
    setOpen(false)
  }

  // 카드(또는 트리거) 바깥을 탭했을 때 닫기. containerRef가 없는 화면(RoutineSetup의
  // flex-wrap 칩 목록 등)에서는 동작하지 않는다.
  useEffect(() => {
    if (!open || !containerRef) return
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside, true)
    return () => document.removeEventListener('pointerdown', handleOutside, true)
  }, [open, containerRef])

  const guideProps = {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerRelease,
    onPointerLeave: handlePointerRelease,
    onPointerCancel: handlePointerRelease,
    onContextMenu: handleContextMenu,
    onClickCapture: handleClickCapture,
    style: { WebkitTouchCallout: 'none' },
  }

  return { open, guideProps, close }
}

// flex-wrap 칩 목록처럼, 트리거 바로 뒤에 패널을 놓아도 레이아웃이 흐트러지지 않는 곳에서 쓰는
// 편의 래퍼(RoutineSetup.jsx의 파트 편집 화면에서 사용). 카드 개념이 없는 화면이라
// containerRef(바깥탭 닫기)는 넘기지 않는다.
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
