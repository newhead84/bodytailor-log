// programBuilder.js - [2026-11-07] 로그 코치 '내 프로그램 만들기'
// 질문 10개 답(목표·일수·시간·경력·유산소 습관·생활 체력·키우고 싶은 쪽·수면·강도·유산소 종목) → 주간 프로그램.
// 규칙 계산(외부 AI 아님). 근거는 건강 수명 관점 조사(프로젝트 문서 BodyTailor_Log_건강수명트레이닝_조사_20261107.md):
//  - 근력: 부위당 주 2회(종합 분석 2016), 처음엔 1–3세트(미국스포츠의학회 2009), 근력 운동 주 30–60분에서 건강 효과 최대(영국스포츠의학저널 종합 분석 2022)
//  - 유산소: 대화는 되는 강도(Zone 2)를 꾸준히 + 숨찬 인터벌 주 1회(심폐 체력과 사망 위험 연구 2018)
//  - 들기·나르기: 악력·전신 당기기(17개국 악력 연구 2015) / 계단·균형: 한 다리 운동·코어 버티기
//  - 회복: 수면이 부족하면 세트를 줄여 시작(피로가 쌓이면 적응보다 피로가 커짐)
// 저장: routineTemplates 문서에 parts + coachRx(종목별 처방) + byCoach, users.coachProgram { v, answers, at }
import { EXERCISE_LIBRARY, getExerciseAtom, buildPartName } from './exerciseLibrary'
import { buildTrainingProfile, normalizeGoals } from './goals'
import { isCompoundExercise } from './strength'

export const COACH_PROGRAM_VERSION = 1
export const COACH_PROGRAM_TITLE = '코치 프로그램'

// 질문(목표·일수·강도는 기존 필드: onboarding.goals · weeklyTargetDays · coachIntensity)
export const PROGRAM_QUESTIONS = [
  { id: 'goals', title: '어떤 몸을 만들고 싶나요?' },
  { id: 'days', title: '일주일에 며칠 운동할 수 있나요?', hint: '무리 없이 지킬 수 있는 날 수로 골라 주세요.', options: [2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d}일` })) },
  {
    id: 'minutes',
    title: '한 번에 얼마나 운동할 수 있나요?',
    hint: '유산소까지 포함한 시간이에요.',
    options: [
      { value: 30, label: '30분', sub: '짧고 굵게' },
      { value: 45, label: '45분' },
      { value: 60, label: '60분' },
      { value: 75, label: '75분 이상' },
    ],
  },
  {
    id: 'exp',
    title: '웨이트 운동은 얼마나 해 봤나요?',
    options: [
      { value: 'new', label: '처음이에요', sub: '머신 위주로 쉽게 시작' },
      { value: 'lt6m', label: '6개월 안쪽' },
      { value: '1to3y', label: '1–3년' },
      { value: '3yplus', label: '3년 넘게' },
    ],
  },
  {
    id: 'cardioHabit',
    title: '요즘 유산소는 얼마나 하나요?',
    hint: '빠르게 걷기·사이클·러닝 모두 포함해요.',
    options: [
      { value: 'none', label: '거의 안 해요', sub: '짧게부터 늘려 가요' },
      { value: 'some', label: '주 1–2번' },
      { value: 'regular', label: '주 3번 넘게' },
    ],
  },
  {
    id: 'life',
    title: '나이 들어서도 꼭 하고 싶은 일은?',
    hint: '그 일을 버틸 체력을 프로그램에 더 넣어요.',
    options: [
      { value: 'carry', label: '무거운 짐 들고 나르기', sub: '들기·당기기·악력' },
      { value: 'stairs', label: '계단·산 오래 오르기', sub: '한 다리 운동·유산소' },
      { value: 'balance', label: '넘어지지 않고 자세 바르게', sub: '균형·코어·등' },
      { value: 'muscle', label: '탄탄한 몸 유지', sub: '전신 근육량' },
    ],
  },
  {
    id: 'focus',
    title: '더 키우고 싶은 쪽이 있나요?',
    options: [
      { value: 'balanced', label: '고르게' },
      { value: 'upper', label: '상체' },
      { value: 'lower', label: '하체·엉덩이' },
    ],
  },
  {
    id: 'sleep',
    title: '평소 잠은 얼마나 자나요?',
    hint: '회복이 부족하면 운동량을 조금 낮춰 시작해요.',
    options: [
      { value: 'low', label: '6시간 안 돼요' },
      { value: 'mid', label: '6–7시간' },
      { value: 'good', label: '7시간 넘게' },
    ],
  },
  { id: 'intensity', title: '세트마다 얼마나 힘들게 할까요?', hint: '나중에 MY › 설정에서 바꿀 수 있어요.' },
  {
    id: 'cardioPref',
    title: '유산소는 무엇이 편한가요?',
    options: [
      { value: '인클라인워킹', label: '경사 걷기' },
      { value: '트레드밀', label: '트레드밀 달리기' },
      { value: '실내사이클', label: '실내 사이클' },
      { value: '스텝밀', label: '스텝밀(천국의 계단)' },
      { value: '로잉머신', label: '로잉머신' },
    ],
  },
]

export const DEFAULT_ANSWERS = { minutes: 60, exp: 'lt6m', cardioHabit: 'some', life: 'muscle', focus: 'balanced', sleep: 'mid', cardioPref: '인클라인워킹' }

const ALL_EXERCISES = new Set(Object.values(EXERCISE_LIBRARY).flat())
const has = (n) => ALL_EXERCISES.has(n)
const first = (...names) => names.find(has) || null

// 동작 칸 → 경력별 종목(앞에 있을수록 우선)
function slotExercise(slot, a) {
  const newbie = a.exp === 'new'
  const vet = a.exp === '1to3y' || a.exp === '3yplus'
  switch (slot) {
    case 'squat':
      return newbie ? first('레그프레스', '고블릿스쿼트') : vet ? first('백스쿼트', '핵스쿼트머신(브이스쿼트머신)') : first('고블릿스쿼트', '레그프레스')
    case 'squat2':
      return newbie ? first('고블릿스쿼트', '레그프레스') : first('레그프레스', '핵스쿼트머신(브이스쿼트머신)')
    case 'hinge':
      return a.life === 'carry' && vet ? first('데드리프트', '루마니안데드리프트') : first('루마니안데드리프트', '백익스텐션')
    case 'single':
      return a.life === 'stairs' || a.life === 'balance' || newbie ? first('스텝업', '덤벨런지') : first('덤벨불가리안스플릿스쿼트', '덤벨런지')
    case 'hamcurl':
      return first('시티드레그컬', '라잉레그컬')
    case 'quadiso':
      return first('레그익스텐션')
    case 'glute':
      return first('바벨힙쓰러스트', '케이블킥백')
    case 'pushH':
      return newbie ? first('체스트프레스머신', '플랫덤벨프레스') : vet ? first('플랫바벨프레스', '플랫덤벨프레스') : first('플랫덤벨프레스', '체스트프레스머신')
    case 'pushI':
      return first('인클라인덤벨프레스', '인클라인체스트프레스머신')
    case 'pushV':
      return newbie ? first('숄더프레스머신', '덤벨숄더프레스') : first('덤벨숄더프레스', '숄더프레스머신')
    case 'pullV':
      return first('랫풀다운', '어시스트풀업')
    case 'pullH':
      return newbie ? first('시티드케이블로우', '원암덤벨로우') : vet ? first('바벨로우', '시티드케이블로우') : first('원암덤벨로우', '시티드케이블로우')
    case 'rear':
      return first('케이블페이스풀', '리어델트펙덱')
    case 'lateral':
      return first('덤벨사이드레터럴레이즈', '케이블레터럴레이즈')
    case 'biceps':
      return a.life === 'carry' ? first('덤벨해머컬', '덤벨컬') : first('덤벨컬', '케이블컬')
    case 'triceps':
      return first('케이블푸시다운', '오버헤드케이블익스텐션')
    case 'grip':
      return first('덤벨슈러그', '바벨슈러그')
    case 'coreA':
      return newbie ? first('데드버그', '플랭크') : a.life === 'carry' && vet ? first('행잉레그레이즈', '앱롤아웃') : first('앱롤아웃', '플랭크')
    case 'coreR':
      return first('팔로프프레스', '사이드플랭크')
    default:
      return null
  }
}

// 분할: 주 2–3일 전신 A/B, 주 4일 상·하체, 주 5–6일은 경력 1년 이상 밀기·당기기·하체, 그 밖은 상·하체
function pickSplit(a) {
  const d = a.days
  if (d <= 3) return 'full'
  if (d === 4) return 'ul'
  return a.exp === '1to3y' || a.exp === '3yplus' ? 'ppl' : 'ul'
}

// 파트별 동작 칸(우선순위 순). 시간이 모자라면 뒤에서부터 빠진다.
function partSlots(split, a) {
  const up = a.focus === 'upper'
  const low = a.focus === 'lower'
  const posture = a.life === 'balance'
  const carry = a.life === 'carry'
  if (split === 'full') {
    return [
      { name: '전신 A', slots: ['squat', 'pushH', 'pullV', a.life === 'stairs' || a.life === 'balance' ? 'single' : a.life === 'carry' ? 'hinge' : 'hamcurl', 'coreA', low ? 'glute' : up ? 'lateral' : 'rear', carry ? 'grip' : 'biceps'] },
      { name: '전신 B', slots: ['hinge', 'pullH', 'pushV', 'single', 'coreR', up ? 'pushI' : low ? 'hamcurl' : 'rear', 'triceps'] },
    ]
  }
  if (split === 'ul') {
    return [
      { name: '상체', slots: ['pushH', 'pullV', 'pullH', 'pushV', posture ? 'rear' : up ? 'pushI' : 'rear', 'coreR', carry ? 'grip' : 'lateral', 'biceps', 'triceps'] },
      { name: '하체', slots: ['squat', 'hinge', 'single', 'coreA', low ? 'glute' : 'hamcurl', 'quadiso', low ? 'hamcurl' : null].filter(Boolean) },
    ]
  }
  return [
    { name: '밀기', slots: ['pushH', 'pushV', 'pushI', 'lateral', 'triceps', up ? 'lateral' : null].filter(Boolean) },
    { name: '당기기', slots: ['pullV', 'pullH', 'rear', carry ? 'grip' : 'biceps', 'coreR', carry ? 'biceps' : null].filter(Boolean) },
    { name: '하체', slots: ['squat', 'hinge', 'single', 'coreA', low ? 'glute' : 'hamcurl', 'quadiso'] },
  ]
}

const roundTo5 = (v) => Math.round(v / 5) * 5
// 힌지(데드리프트류)는 라이브러리에서 등에도 있지만 프로그램 합계는 하체로 본다
const HINGE_AS_LEG = new Set(['루마니안데드리프트', '데드리프트', '스모데드리프트'])
export const atomOf = (n) => (HINGE_AS_LEG.has(n) ? '하체' : getExerciseAtom(n))

// 주간 유산소 계획: 목표 기준 분(goals.js)에서 습관에 따라 시작량을 낮추고, 경력·습관이 되면 인터벌 주 1회
function cardioPlan(a, profile) {
  const target = profile.cardioGoalMin || 150
  const start = a.cardioHabit === 'none' ? Math.max(60, roundTo5(target * 0.6)) : a.cardioHabit === 'some' ? roundTo5(target * 0.8) : target
  const wantsInterval = a.cardioHabit !== 'none' && a.exp !== 'new' && a.minutes >= 45
  const intervalMin = wantsInterval ? 20 : 0
  // 인터벌은 고강도라 2배로 친다(주간 유산소 계산과 같은 기준 isVigorousCardio)
  const zone2Week = Math.max(0, start - intervalMin * 2)
  return { weekMin: start, zone2Week, intervalMin, target }
}

const SET_MIN = 2.7 // 세트 1개 + 휴식 평균 분(다관절 휴식이 길고 고립은 짧음)

export function buildProgram(input) {
  const a = { ...DEFAULT_ANSWERS, ...input }
  a.days = Math.min(6, Math.max(2, Number(a.days) || 3))
  a.minutes = Number(a.minutes) || 60
  const goals = normalizeGoals(a.goals)
  const beginner = a.exp === 'new' || a.exp === 'lt6m'
  const profile = buildTrainingProfile(goals, { beginner })
  const split = pickSplit(a)
  const partsDef = partSlots(split, a)
  const sessionsPerPart = a.days / partsDef.length
  const cardio = cardioPlan(a, profile)
  const big = profile.primary === 'muscle' || profile.primary === 'bone'

  // 인터벌은 하체가 아닌 파트 하나에(다리 피로가 겹치지 않게)
  const intervalPart = cardio.intervalMin ? partsDef.findIndex((p) => p.name !== '하체') : -1
  const zone2PerSession = cardio.zone2Week ? Math.min(40, Math.max(10, roundTo5(cardio.zone2Week / a.days))) : 0
  const intervalName = a.cardioPref === '실내사이클' ? first('에어바이크', '트레드밀인터벌') : first('트레드밀인터벌', '에어바이크')
  const zone2Name = first(a.cardioPref, '인클라인워킹')

  const coachRx = {}
  const upperAtoms = ['가슴', '등', '어깨', '이두', '삼두']
  // 부위별 주간 세트가 목표 상한(goals.js weeklySets.max)을 넘지 않게(코어 제외)
  const atomWeek = {}
  const weekMax = profile.weeklySets.max
  const overWeek = (n, add) => atomOf(n) !== '코어' && (atomWeek[atomOf(n)] || 0) + add * sessionsPerPart > weekMax
  const parts = partsDef.map((pd, idx) => {
    const isInterval = idx === intervalPart
    // 유산소는 한 번 운동 시간의 35%까지(짧은 날 근력 시간이 모자라지 않게)
    const cardioCap = Math.max(10, roundTo5(a.minutes * 0.35))
    const cardioMin = Math.min(isInterval ? cardio.intervalMin : zone2PerSession, cardioCap)
    // 근력에 쓸 수 있는 시간: 전체 - 웜업 5분 - 유산소
    let budget = Math.max(12, a.minutes - 5 - cardioMin)
    if (a.sleep === 'low') budget *= 0.85
    let setBudget = Math.floor(budget / SET_MIN)
    const exercises = []
    const setsOf = {}
    const seen = new Set()
    // 1단계: 종목마다 기본 세트(다관절 3·고립 2, 처음·30분이면 2)로 최대한 여러 동작을 넣는다(최소 3종목)
    for (const slot of pd.slots) {
      const name = slotExercise(slot, a)
      if (!name || seen.has(name)) continue
      const comp = isCompoundExercise(name)
      const core = atomOf(name) === '코어'
      const sets = core || !comp || a.exp === 'new' || a.minutes <= 30 ? 2 : 3
      // 코어(안정성)는 시간이 모자라도 1종목은 넣는다
      const hasCore = exercises.some((n) => getExerciseAtom(n) === '코어')
      if (exercises.length >= 3 && setBudget - sets < 0 && !(core && !hasCore)) continue
      if (exercises.length >= 3 && overWeek(name, sets)) continue
      atomWeek[atomOf(name)] = (atomWeek[atomOf(name)] || 0) + sets * sessionsPerPart
      setBudget -= sets
      seen.add(name)
      exercises.push(name)
      setsOf[name] = sets
    }
    // 2단계: 남은 시간은 다관절에 1세트씩(키우고 싶은 쪽 먼저). 근육·뼈 1순위는 4세트까지, 그 밖·처음 6개월은 3세트까지
    const cap = beginner ? 3 : big ? 4 : 3
    const focusFirst = [...exercises].sort((x, y) => {
      const fx = (a.focus === 'upper' && upperAtoms.includes(atomOf(x))) || (a.focus === 'lower' && atomOf(x) === '하체') ? 0 : 1
      const fy = (a.focus === 'upper' && upperAtoms.includes(atomOf(y))) || (a.focus === 'lower' && atomOf(y) === '하체') ? 0 : 1
      return fx - fy
    })
    let grew = true
    while (setBudget > 0 && grew) {
      grew = false
      for (const n of focusFirst) {
        if (setBudget <= 0) break
        if (!isCompoundExercise(n) || atomOf(n) === '코어' || setsOf[n] >= cap || overWeek(n, 1)) continue
        atomWeek[atomOf(n)] = (atomWeek[atomOf(n)] || 0) + sessionsPerPart
        setsOf[n] += 1
        setBudget -= 1
        grew = true
      }
    }
    exercises.forEach((name) => {
      const comp = isCompoundExercise(name)
      const core = atomOf(name) === '코어'
      const range = core ? (name === '플랭크' || name === '사이드플랭크' ? [30, 45] : [8, 12]) : comp ? [profile.compound.repMin, profile.compound.repMax] : [profile.iso.repMin, profile.iso.repMax]
      // 같은 종목이 두 파트에 있으면 처방은 하나(먼저 만든 값)로
      if (!coachRx[name]) coachRx[name] = { sets: setsOf[name], repMin: range[0], repMax: range[1] }
    })
    if (cardioMin > 0) {
      const cName = isInterval ? intervalName : zone2Name
      if (cName && !seen.has(cName)) {
        exercises.push(cName)
        if (!coachRx[cName]) {
          coachRx[cName] = isInterval
            ? { kind: 'interval', minutes: cardioMin, note: '3분 가볍게 → 4분 숨차게(말하기 힘든 정도) · 3분 가볍게, 이걸 2–3번' }
            : { kind: 'zone2', minutes: cardioMin, note: '대화는 되지만 노래는 어려운 강도로 꾸준히' }
        }
      }
    }
    const atoms = []
    exercises.forEach((n) => {
      const at = atomOf(n)
      if (at && !atoms.includes(at)) atoms.push(at)
    })
    return { name: pd.name || buildPartName(atoms), atoms, exercises }
  })

  // 주간 합계
  const weeklySets = {}
  let strengthSetsWeek = 0
  parts.forEach((p) =>
    p.exercises.forEach((n) => {
      const rx = coachRx[n]
      if (!rx?.sets) return
      const at = atomOf(n)
      const s = rx.sets * sessionsPerPart
      weeklySets[at] = (weeklySets[at] || 0) + s
      strengthSetsWeek += s
    })
  )
  const strengthMinWeek = Math.round(strengthSetsWeek * SET_MIN)
  const cardioMinWeek = Math.round(
    parts.reduce((sum, p) => sum + p.exercises.reduce((x, n) => x + (coachRx[n]?.minutes || 0), 0), 0) * sessionsPerPart
  )
  const sessionMin = parts.map((p) => Math.round(5 + p.exercises.reduce((x, n) => x + (coachRx[n]?.sets ? coachRx[n].sets * SET_MIN : coachRx[n]?.minutes || 0), 0)))

  const splitLabel = split === 'full' ? '전신 A/B 번갈아' : split === 'ul' ? '상체·하체 번갈아' : '밀기·당기기·하체 돌아가며'
  const reasons = [
    {
      text: `주 ${a.days}일이라 ${splitLabel} 해요. 한 부위를 주 약 ${Math.round(sessionsPerPart * 10) / 10}회 하게 돼요. 근육은 부위당 주 2회 나눠 할 때 더 잘 자라요.`,
      src: '근력 운동 빈도 종합 분석(2016)',
    },
    {
      text: strengthMinWeek > 60
        ? `근력 운동은 주 약 ${strengthMinWeek}분이에요. 건강 효과는 주 30–60분에서 가장 컸고, 그보다 많이 하면 근육·근력은 더 늘지만 건강 효과가 더 커지지는 않았어요. 유산소와 함께 하면 효과가 더 컸어요.`
        : `근력 운동은 주 약 ${strengthMinWeek}분이에요. 근력 운동을 주 30–60분 하는 사람들에게서 건강 효과가 가장 크게 나타났고, 유산소와 함께 하면 더 컸어요.`,
      src: '영국스포츠의학저널 종합 분석(2022) · 관찰 연구',
    },
    {
      text: cardio.intervalMin
        ? `유산소는 주 약 ${cardioMinWeek}분: 대화되는 강도로 꾸준히 + 숨찬 인터벌 주 1회예요. 심폐 체력이 높은 사람일수록 오래 건강하게 사는 경향이 뚜렷했어요.`
        : `유산소는 주 약 ${cardioMinWeek}분, 대화되는 강도로 시작해요. 익숙해지면 숨찬 인터벌을 주 1회 넣어요. 심폐 체력이 높은 사람일수록 오래 건강하게 사는 경향이 뚜렷했어요.`,
      src: '심폐 체력과 사망 위험 연구(2018, 12만 명) · 관찰 연구',
    },
  ]
  if (beginner) reasons.push({ text: '처음 몇 달은 종목당 2–3세트로 시작해 자세를 익혀요. 그것만으로도 힘이 충분히 늘어요.', src: '미국스포츠의학회 운동 지침(2009)' })
  if (a.life === 'carry') reasons.push({ text: '짐을 드는 힘은 엉덩이·등으로 들어 올리는 힘과 손아귀 힘이에요. 들어 올리기·당기기·슈러그를 넣었어요. 손아귀 힘이 센 사람들이 더 건강한 경향이 있어요.', src: '17개국 악력 연구(2015) · 관찰 연구' })
  if (a.life === 'stairs') reasons.push({ text: '계단은 한 다리로 몸을 밀어 올리는 동작이라 스텝업 같은 한 다리 운동과 유산소를 넣었어요.', src: '' })
  if (a.life === 'balance') reasons.push({ text: '균형은 한 다리 운동과 몸통을 버티는 코어 운동, 등 뒤쪽(페이스풀)으로 지켜요.', src: '' })
  if (a.sleep === 'low') reasons.push({ text: '잠이 부족하면 회복이 늦어 세트를 조금 줄여 시작했어요. 몸이 버거우면 로그 코치가 쉬어 가는 주를 알려 줘요.', src: '' })
  if (profile.cardioGoalMin && cardio.weekMin < profile.cardioGoalMin) reasons.push({ text: `유산소는 지금 습관에 맞춰 낮게 시작했어요. 목표는 주 ${profile.cardioGoalMin}분이에요.`, src: '' })

  return {
    version: COACH_PROGRAM_VERSION,
    answers: { minutes: a.minutes, exp: a.exp, cardioHabit: a.cardioHabit, life: a.life, focus: a.focus, sleep: a.sleep, cardioPref: a.cardioPref },
    days: a.days,
    goals,
    split,
    splitLabel,
    sessionsPerPart,
    parts,
    coachRx,
    weeklySets,
    strengthMinWeek,
    cardioMinWeek,
    sessionMin,
    reasons,
  }
}

export function findCoachProgramTemplate(templates) {
  return (templates || []).find((t) => t.byCoach && !t.byTrainer) || null
}
