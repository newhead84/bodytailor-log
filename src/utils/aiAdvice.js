// aiAdvice.js
// v8 설계안 8.4 "AI 어드바이스" + 8.9 "AI 모델 연동" 담당.
//
// ⚠️ 보안 설계 TODO (프로젝트 지침 3번 참고)
// 지금은 사용자가 MY 탭에서 입력한 API 키를 그대로 클라이언트에서 fetch에 사용한다.
// - Claude: anthropic-dangerous-direct-browser-access 헤더로 브라우저 직접 호출이 가능하지만,
//   이 헤더는 프로토타입 용도이며 키가 브라우저 네트워크 탭에 그대로 노출된다.
// - OpenAI/GPT: 브라우저 CORS를 기본적으로 막아두는 경우가 많아 별도 프록시(Cloud Functions 등)가
//   필요할 가능성이 높다.
// - Gemini: generativelanguage.googleapis.com은 브라우저 호출을 허용하는 편이나, 동일하게 키 노출 문제는 남는다.
// 실사용 단계에서는 Firebase Functions 등으로 프록시를 두고, 키는 서버(Secret Manager)에만
// 보관하도록 전환하는 것을 권장한다. 지금 구조는 "동작하는 v1"을 위한 임시 설계다.

function buildPrompt(onboarding) {
  const goals = (onboarding.goals || []).join(', ') || '미입력'
  return [
    '너는 운동생리학과 재활운동에 정통한 퍼스널 트레이너야.',
    '아래 회원 정보를 보고, 과학적 근거(ACSM/NSCA 수준)를 바탕으로 5줄 이내의 시작 가이드를 한국어로 작성해줘.',
    '추측성 속설은 배제하고, 실천 가능한 조언 위주로 작성해줘.',
    '',
    `운동 수준: ${onboarding.level}`,
    `성별: ${onboarding.gender}`,
    `나이: ${onboarding.age}세`,
    `체중: ${onboarding.weightKg}kg`,
    `신장: ${onboarding.heightCm}cm`,
    `운동 목표: ${goals}`,
  ].join('\n')
}

async function callClaude(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API 오류 (${res.status})`)
  const data = await res.json()
  return (data.content || []).map((b) => b.text || '').join('\n').trim()
}

async function callGpt(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }),
  })
  if (!res.ok) throw new Error(`GPT API 오류 (${res.status})`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function callGemini(apiKey, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) throw new Error(`Gemini API 오류 (${res.status})`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

export async function requestAiAdvice(provider, apiKey, onboarding) {
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }
  const prompt = buildPrompt(onboarding)
  if (provider === 'claude') return callClaude(apiKey, prompt)
  if (provider === 'gpt') return callGpt(apiKey, prompt)
  if (provider === 'gemini') return callGemini(apiKey, prompt)
  throw new Error('UNKNOWN_PROVIDER')
}
