// useBackableScreen.js
// [2026-07-29 신규] 하단 4탭 내에서 "세부화면"으로 전환되는 지점(예: MY탭 "운동조합 변경",
// "등급 정보", 그 안의 파트 추가/수정 화면 등, 상단에 "← 돌아가기" 버튼이 있는 화면들)에서
// 기기/브라우저의 뒤로가기 제스처를 누르면 앱이 그대로 꺼지는 대신 해당 세부화면만 닫고
// 이전 화면으로 돌아가도록 만드는 공용 훅.
//
// 동작 원리: 화면이 열릴 때 history 엔트리를 하나 쌓아두고, 뒤로가기(popstate)가 오면
// 그 엔트리가 소비된 것으로 보고 onClose를 호출한다. "돌아가기" 버튼 클릭 등 다른 방식으로
// 화면이 닫히는 경우에는 반대로 history.back()을 호출해 앞서 쌓아둔 엔트리를 스스로 정리한다.
// 이렇게 해야 실제 화면 전환 깊이와 history 스택 깊이가 항상 일치해서, 다음 번 뒤로가기가
// "한 번 눌렀는데 아무 반응 없는" 상태 없이 정확히 한 단계씩 닫힌다.
//
// 여러 단계가 중첩되어도(예: 운동조합 변경 화면 안에서 파트 추가 화면을 또 여는 경우) 브라우저
// history는 항상 LIFO 순서로 쌓이므로, 각 화면이 독립적으로 이 훅을 사용하기만 하면 뒤로가기를
// 누를 때마다 가장 안쪽 화면부터 순서대로 닫힌다. 앱 루트(최상위, 세부화면이 하나도 열리지
// 않은 상태)에서는 App.jsx의 기존 가드가 앱 종료 자체를 막는 역할을 그대로 담당한다.

import { useEffect, useRef } from 'react'

// [2026-10-31 버그 수정] 안쪽 화면이 "저장/취소"로 닫히며 history.back()을 직접 호출하면, 그 popstate를
// 바깥 화면(예: 운동방식 변경, 내 회원)의 훅도 받아 함께 닫혀 버렸다(루틴 수정 저장 → MY로 튕김).
// 스스로 부른 back()에서 생긴 popstate는 모든 훅이 무시하도록 모듈 공용 플래그를 둔다.
// 플래그는 해당 popstate의 모든 리스너가 실행된 뒤(setTimeout 0) 풀린다.
// 또 기기 뒤로가기 한 번에 열린 화면이 모두(바깥까지) 닫히던 문제도 있어, 열린 순서 스택을 두고
// 가장 안쪽(마지막에 열린) 화면 하나만 닫는다.
let selfBackPending = false
const openStack = []
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (selfBackPending) setTimeout(() => { selfBackPending = false }, 0)
  })
}

function removeFromStack(id) {
  const i = openStack.lastIndexOf(id)
  if (i !== -1) openStack.splice(i, 1)
}

export function useBackableScreen(isOpen, onClose) {
  const pushedRef = useRef(false)
  const closingSelfRef = useRef(false)
  const idRef = useRef(null)
  if (!idRef.current) idRef.current = {}

  // 화면 열림/닫힘에 따라 history 엔트리를 쌓거나 정리한다.
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      pushedRef.current = true
      openStack.push(idRef.current)
      window.history.pushState({ bodytailorScreen: true }, '')
    } else if (!isOpen && pushedRef.current) {
      pushedRef.current = false
      removeFromStack(idRef.current)
      if (!closingSelfRef.current) {
        // 뒤로가기가 아니라 화면 안의 "돌아가기/취소" 버튼 등으로 닫힌 경우:
        // 앞서 쌓아둔 엔트리를 우리가 직접 소비해서 history 깊이를 맞춘다.
        closingSelfRef.current = true
        selfBackPending = true
        setTimeout(() => { selfBackPending = false }, 1000) // popstate가 안 오는 예외 상황 대비
        window.history.back()
        setTimeout(() => {
          closingSelfRef.current = false
        }, 0)
      }
    }
  }, [isOpen])

  // 열린 채로 언마운트되면(상위 화면이 먼저 닫힘 등) 스택에서만 뺀다.
  useEffect(() => () => {
    if (pushedRef.current) removeFromStack(idRef.current)
  }, [])

  // 뒤로가기(popstate) 발생 시, 우리가 쌓아둔 엔트리가 소비되는 것이면 화면을 닫는다.
  useEffect(() => {
    function handlePopState(e) {
      if (selfBackPending || e.__btScreenHandled) return
      if (pushedRef.current && openStack[openStack.length - 1] === idRef.current) {
        e.__btScreenHandled = true
        pushedRef.current = false
        removeFromStack(idRef.current)
        closingSelfRef.current = true
        onClose()
        setTimeout(() => {
          closingSelfRef.current = false
        }, 0)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [onClose])
}
