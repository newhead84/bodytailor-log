// trainerProfile.js - [2026-10-31] 트레이너 프로필 공용 헬퍼(대시보드 편집·앱 소개)
// 기본 3명: 대시보드에 프로필이 하나도 없을 때 "기본 프로필 등록" 버튼으로 넣는다(사진·내용은 이후 대시보드에서 수정).
// 내용 출처: 바디테일러 블로그 트레이너 소개 글(2026-10-31 MOON 제공). 홍보 가격·전화번호는 넣지 않음.
export const DEFAULT_TRAINER_PROFILES = [
  {
    name: '이지호',
    title: '대표 트레이너',
    photos: ['/trainers/leejiho-1.webp', '/trainers/leejiho-2.webp'],
    avatar: '/trainers/leejiho-a.webp',
    specialties: ['재활운동', '체형교정'],
    intro: '서울과학기술대학교에서 스포츠과학을 전공하고, 재활운동·체형교정 자격을 갖춘 바디테일러PT 대표 트레이너입니다.',
    career: ['現 바디테일러PT 대표', '前 대치현대아파트 휘트니스 운영', '前 아이러브휘트니스 트레이너', '前 해피짐 2호점 트레이너', '前 바디퍼포먼스(구의점) 트레이너'],
    certs: ['서울과학기술대학교 스포츠과학 졸업', '생활스포츠지도자 2급 (보디빌딩)', '한국인재교육원 RTS (Rehab Training Specialist)', 'A-FIT 재활운동·체형교정 전문가', 'SPOSA 재활트레이닝 및 마사지 수료', 'ROTC 53기'],
  },
  {
    name: '배성범',
    title: '트레이너',
    photos: ['/trainers/baesungbeom-1.webp'],
    avatar: '/trainers/baesungbeom-a.webp',
    specialties: ['교정운동', '다이어트', '근육 증가', '체력 증진'],
    intro: '운동하는 이유는 다이어트, 근육 증가, 체력 증진처럼 저마다 다르고, 목표를 이루려면 많은 노력이 필요합니다. 저는 그 노력의 가치와 효율을 올려드립니다.\n\n런닝머신만 타거나 같은 동작만 반복하는, 변화 없는 노력이 아니라 노력한 만큼 변화할 수 있게 앞에서 이끌어 드릴게요.',
    career: ['現 바디테일러PT (2026년 7월~)', '아이언짐 신길점', '바르다짐 병무청점'],
    certs: ['생활체육지도사 2급 (보디빌딩)', '노인스포츠지도사 (보디빌딩)', 'CES Korea PTC 자격 취득 및 교육 수료', 'CES Korea 교정운동 전문가 과정 수료', 'CES Korea CTT 교정 테이핑 과정 수료', 'CES Korea 기능해부학 전문가 과정 수료', 'FISAF 국제 퍼스널 트레이너 1급', 'IPF 지도사 2급', '메디컬 트레이닝 교육 수료', '이파마스터 온라인 교육 다수 수료', '한국응급처치교육원 BLS Provider'],
  },
  {
    name: '박동진',
    title: '트레이너',
    photos: ['/trainers/parkdongjin-1.webp', '/trainers/parkdongjin-2.webp'],
    avatar: '/trainers/parkdongjin-a.webp',
    specialties: ['모빌리티', '통증케어', '재활', '기능회복', '근막이완'],
    intro: '약손명가와 한의원에서 체형관리사로 일한 다년간의 경험을 토대로 근막이완과 올바른 운동을 제공해 드립니다. 승모근·종아리 붓기처럼 몸의 불편함을 풀면서 매일 갱신되는 리즈 시절을 만나 보세요!',
    hours: '07:00 ~ 15:00',
    career: ['現 바디테일러PT', '약손명가 체형관리사', '한의원 체형관리사', '트레이너 경력 4년 이상'],
    certs: ['생활스포츠지도자 2급 (보디빌딩)', '운동처방사', '실버건강지도사', '병원코디네이터', '미용사 (피부)', 'CTT 테이핑'],
  },
]

// 사진 파일 → 최대 640px, webp(미지원 시 jpeg) data URL. 장당 280KB 안으로 품질을 낮춰 맞춘다(3장까지 한 문서에 저장).
export async function resizePhoto(file, max = 640) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    for (const q of [0.85, 0.75, 0.65, 0.5, 0.4]) {
      let out = c.toDataURL('image/webp', q)
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', q)
      if (out.length <= 280000) return out // 3장 × 280KB + 글 < 문서 1MB 한도
    }
    throw new Error('사진이 너무 커요. 다른 사진을 골라 주세요.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const splitLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20).map((x) => x.slice(0, 80))
export const splitTags = (s) => String(s || '').split(/[,·\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 20))
export function instagramUrl(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/^https?:\/\//.test(s)) return s
  return `https://www.instagram.com/${s.replace(/^@/, '')}`
}

// 사진 목록(최대 3장, 첫 장이 대표). 예전 단일 photo 필드도 읽는다.
export const MAX_TRAINER_PHOTOS = 3
export function photoList(p) {
  if (Array.isArray(p?.photos) && p.photos.length) return p.photos.filter(Boolean).slice(0, MAX_TRAINER_PHOTOS)
  return p?.photo ? [p.photo] : []
}
