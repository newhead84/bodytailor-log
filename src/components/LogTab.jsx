import React, { forwardRef } from 'react'
import WorkoutInput from './WorkoutInput'

// [2026-07-28] 기존에 이 탭 상단에 있던 '입력/통계' 서브탭 토글을 제거했다. 통계(StatsView)는
// 눈에 잘 띄지 않는다는 피드백에 따라 하단 네비게이션의 '리포트' 탭(구 랭킹 탭)으로 이전했고,
// 기록탭은 이제 운동기록 입력(WorkoutInput)만 보여준다.
// [2026-07-30] 홈탭의 "운동중" 상태 표시 + 취소 버튼을 위해 WorkoutInput의 ref(cancelSession)와
// onSessionPhaseChange를 그대로 통과시킨다.
const LogTab = forwardRef(function LogTab(
  { uid, routineTemplates, weightKg, restNotificationEnabled, restWakeLockEnabled, restSoundId, onLogSaved, onRoutineUpdated, onSessionPhaseChange, customExercises },
  ref
) {
  return (
    <WorkoutInput
      ref={ref}
      uid={uid}
      routineTemplates={routineTemplates}
      weightKg={weightKg}
      restNotificationEnabled={restNotificationEnabled}
      restWakeLockEnabled={restWakeLockEnabled}
      restSoundId={restSoundId}
      onSaved={onLogSaved}
      onRoutineUpdated={onRoutineUpdated}
      onSessionPhaseChange={onSessionPhaseChange}
      customExercises={customExercises}
    />
  )
})

export default LogTab
