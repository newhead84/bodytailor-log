import React, { useEffect, useState } from 'react'
import { Card, SectionTitle, Button, EmptyState } from './ui'
import { getRecentWorkoutLogs, getLatestAiAdvice } from '../storage'
import CalendarView from './CalendarView'

export default function HomeTab({ uid, userDoc, onGoToLog }) {
  const [recentLogs, setRecentLogs] = useState([])
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [logs, latestAdvice] = await Promise.all([getRecentWorkoutLogs(uid, 3), getLatestAiAdvice(uid)])
      if (cancelled) return
      setRecentLogs(logs)
      setAdvice(latestAdvice)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [uid])

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 4px' }}>
        {userDoc?.nickname || '회원'}님, 오늘도 몸에 투자할 시간이에요.
      </p>

      <SectionTitle>오늘의 운동</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <p className="text-keep-all" style={{ fontSize: 14, margin: '0 0 12px', color: 'var(--color-label-normal)' }}>
          {recentLogs[0] ? `최근 기록: ${recentLogs[0].date}` : '아직 기록이 없어요. 첫 세트를 시작해 볼까요?'}
        </p>
        <Button full onClick={onGoToLog}>
          오늘 운동 기록하러 가기
        </Button>
      </Card>

      <SectionTitle>캘린더</SectionTitle>
      <div style={{ margin: '0 -20px 4px' }}>
        <CalendarView uid={uid} />
      </div>

      <SectionTitle>AI 어드바이스</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
        ) : advice ? (
          <p className="text-keep-all multiline-list" style={{ fontSize: 14, margin: 0, lineHeight: '22px' }}>
            {advice.adviceText}
          </p>
        ) : (
          <EmptyState
            title="아직 어드바이스가 없어요"
            description="MY 탭에서 AI 모델을 연동하면 온보딩 정보를 기반으로 시작 가이드를 받을 수 있어요."
          />
        )}
      </Card>

      {recentLogs.length > 0 && (
        <>
          <SectionTitle>최근 운동 기록</SectionTitle>
          {recentLogs.map((log) => (
            <Card key={log.id} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{log.date}</div>
              {log.exercises.slice(0, 3).map((ex) => (
                <div key={ex.name} style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
                  {ex.name}{' '}
                  <span className="record-notation">{ex.sets.map((s) => `${s.weight}x${s.reps}`).join('/')}</span>
                </div>
              ))}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
