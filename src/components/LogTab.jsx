import React from 'react'
import WorkoutInput from './WorkoutInput'

// [2026-07-28] 기존에 이 탭 상단에 있던 '입력/통계' 서브탭 토글을 제거했다. 통계(StatsView)는
// 눈에 잘 띄지 않는다는 피드백에 따라 하단 네비게이션의 '리포트' 탭(구 랭킹 탭)으로 이전했고,
// 기록탭은 이제 운동기록 입력(WorkoutInput)만 보여준다.
export default function LogTab({ uid, routineTemplates, weightKg, restNotificationEnabled, restWakeLockEnabled, restSoundId, onLogSaved, onRoutineUpdated }) {
  return (
    <WorkoutInput
      uid={uid}
      routineTemplates={routineTemplates}
      weightKg={weightKg}
      restNotificationEnabled={restNotificationEnabled}
      restWakeLockEnabled={restWakeLockEnabled}
      restSoundId={restSoundId}
      onSaved={onLogSaved}
      onRoutineUpdated={onRoutineUpdated}
    />
  )
}
