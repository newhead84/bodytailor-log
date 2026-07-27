import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Copy, Check,
  Loader2, Upload, RotateCcw, Pencil, X, Settings, AlertTriangle, Sparkles
} from "lucide-react";
import { subscribeAuth, signInWithGoogle, signOutUser } from "./firebase";
import { storage, setUid } from "./storage";

// ============ constants ============
const CATEGORY_ORDER = ["하체&어깨", "등&이두", "가슴&삼두", "코어", "유산소", "기타"];
const SPLIT_CATEGORIES = ["하체&어깨", "등&이두", "가슴&삼두"];

const CATEGORY_STYLE = {
  "하체&어깨": { text: "#B23A2E", bg: "#FBEAE8" },
  "등&이두": { text: "#2B5B8C", bg: "#E9F1FA" },
  "가슴&삼두": { text: "#6B6E3F", bg: "#F1F2E6" },
  "코어": { text: "#96690F", bg: "#FBF1DF" },
  "유산소": { text: "#1F7A63", bg: "#E5F5F0" },
  "기타": { text: "#55585F", bg: "#EEEFF1" },
};
const CATEGORY_UNIT = { "하체&어깨": "kg", "등&이두": "kg", "가슴&삼두": "kg", "기타": "kg", "코어": "회", "유산소": "분" };

const EXERCISE_DB = {
  "하체&어깨": ["스쿼트", "레그프레스", "레그익스텐션", "레그컬", "루마니안데드리프트", "데드리프트", "힙쓰러스트", "런지", "불가리안스플릿스쿼트", "카프레이즈", "브이스쿼트", "스미스스쿼트", "머신숄더프레스", "덤벨숄더프레스", "스미스숄더프레스", "아놀드프레스", "사이드레터럴레이즈", "프론트레이즈", "리어델트펙덱", "케이블레터럴레이즈", "업라이트로우"],
  "등&이두": ["랫풀다운", "랫풀다운(내로우언더그립)", "풀업", "친업", "시티드케이블로우", "바벨로우", "원암덤벨로우", "티바로우", "플레이트레터럴로우", "스트레이트암풀다운", "데드리프트", "케이블컬", "덤벨컬", "바벨컬", "리버스바벨컬", "해머컬", "컨센트레이션컬", "프리처컬", "인클라인덤벨컬"],
  "가슴&삼두": ["벤치프레스", "인클라인벤치프레스", "인클라인덤벨프레스", "인클라인스미스프레스", "디클라인프레스", "펙덱플라이", "케이블크로스오버", "스벤드프레스", "헥스프레스", "딥스", "푸시업", "로프푸시다운", "케이블푸시다운바", "더블홀로프푸시다운", "오버헤드익스텐션", "스컬크러셔", "클로즈그립벤치프레스"],
  "코어": ["행잉레그레이즈", "행잉레그레이즈(무릎굽힘)", "크런치", "케이블크런치", "플랭크", "사이드플랭크", "러시안트위스트", "앱롤아웃", "레그레이즈", "바이시클크런치"],
  "유산소": ["트레드밀", "왕복걷기", "사이클", "로잉머신", "천국의계단", "일립티컬", "계단오르기", "줄넘기"],
};

const PAIN_OPTIONS = ["무릎", "어깨", "허리", "손목", "없음"];
const GOAL_OPTIONS = ["골밀도 향상", "근육량 증가", "체지방 감소", "콜레스테롤 개선", "기능성 스트렝스"];
const SPLIT_OPTIONS = [
  { id: "3split", label: "3분할", desc: "하체&어깨 · 등&이두 · 가슴&삼두 순환" },
  { id: "2split", label: "2분할", desc: "상체 · 하체" },
  { id: "multisplit", label: "4~5분할", desc: "부위별로 세분화해서 수행" },
  { id: "none", label: "무분할 / 자유수행", desc: "그날그날 컨디션에 맞춰 진행" },
];
const CAUTION_MAP = {
  "무릎": ["하체&어깨"], "어깨": ["하체&어깨", "등&이두", "가슴&삼두"],
  "허리": ["하체&어깨"], "손목": ["가슴&삼두", "등&이두"],
};

// ============ pure helpers ============
function pad(n) { return String(n).padStart(2, "0"); }
function toLocalDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return toLocalDateStr(new Date()); }
function addDays(dateStr, n) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n); return toLocalDateStr(d); }
function mondayOf(dateStr) { const d = new Date(dateStr + "T00:00:00"); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return toLocalDateStr(d); }
function weekDates(anchorStr) { const mon = mondayOf(anchorStr); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
function weekdayKR(dateStr) { return ["일", "월", "화", "수", "목", "금", "토"][new Date(dateStr + "T00:00:00").getDay()]; }
function parseNum(v) { if (v === null || v === undefined) return null; const m = String(v).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)); }
function setsToStr(sets, category) {
  return sets.map(s => (category === "코어" || category === "유산소") ? (s.reps || "") : (s.weight ? `${s.weight}x${s.reps}` : (s.reps || ""))).join("/");
}
function entryMetric(entry) {
  if (entry.category === "유산소" || entry.category === "코어") return entry.sets.reduce((sum, s) => sum + (parseNum(s.reps) || 0), 0);
  return entry.sets.reduce((sum, s) => sum + (parseNum(s.weight) || 0) * (parseNum(s.reps) || 0), 0);
}
function maxWeight(sets) { return sets.reduce((m, s) => Math.max(m, parseNum(s.weight) || 0), 0); }
function flattenRange(data, dates) { const out = []; dates.forEach(d => (data[d] || []).forEach(e => out.push({ ...e, date: d }))); return out; }
function aggregateByCategory(entries) { const agg = {}; CATEGORY_ORDER.forEach(c => (agg[c] = 0)); entries.forEach(e => { agg[e.category] = (agg[e.category] || 0) + entryMetric(e); }); return agg; }
function parseImportText(text) {
  const lines = text.split("\n"); const result = {}; let count = 0;
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    const tokens = line.split(/\s+/); if (tokens.length < 4) continue;
    const [date, category, exercise, setsRaw] = tokens;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const sets = setsRaw.split("/").filter(Boolean).map(part => part.includes("x") ? { weight: part.split("x")[0], reps: part.split("x")[1] } : { weight: "", reps: part });
    if (!result[date]) result[date] = [];
    result[date].push({ id: uid(), category, exercise, sets, note: "" });
    count++;
  }
  return { result, count };
}
function nextRecommendedCategory(data, profile) {
  if (!profile || profile.splitType !== "3split" || !profile.splitOrder || profile.splitOrder.length !== 3) return null;
  const dates = Object.keys(data).sort().reverse();
  for (const d of dates) {
    const found = (data[d] || []).find(e => profile.splitOrder.includes(e.category));
    if (found) { const idx = profile.splitOrder.indexOf(found.category); return profile.splitOrder[(idx + 1) % 3]; }
  }
  return profile.splitOrder[0];
}

// ============ small UI atoms ============
const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, monospace";

function Tag({ text, style }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: style.bg, color: style.text }}>{text}</span>;
}

function VolumeBar({ label, value, prevValue, unit, style }) {
  const scaleMax = Math.max(value, prevValue, 1);
  const pct = value > 0 ? Math.min(100, Math.max(6, Math.round((value / scaleMax) * 100))) : 0;
  let delta = null;
  if (prevValue > 0 && value > 0) delta = Math.round(((value - prevValue) / prevValue) * 100);
  else if (prevValue === 0 && value > 0) delta = "new";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#14161A" }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#6B7280" }}>
          {Math.round(value)}{unit}
          {delta !== null && (
            <span style={{ marginLeft: 6, fontWeight: 700, color: delta === "new" || delta > 0 ? "#1B9C6E" : delta < 0 ? "#E0483F" : "#6B7280" }}>
              {delta === "new" ? "NEW" : (delta > 0 ? `▲${delta}%` : delta < 0 ? `▼${Math.abs(delta)}%` : "—")}
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: style.text, opacity: 0.85 }} />
      </div>
    </div>
  );
}

// ============ onboarding ============
function Onboarding({ onComplete }) {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [pain, setPain] = useState([]);
  const [goals, setGoals] = useState([]);
  const [splitType, setSplitType] = useState("");
  const [splitOrder, setSplitOrder] = useState([]);
  const [err, setErr] = useState("");

  function toggle(arr, setArr, v) { setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]); }
  function toggleSplitOrder(cat) {
    setSplitOrder(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : (prev.length < 3 ? [...prev, cat] : prev));
  }

  function submit() {
    if (!splitType) { setErr("현재 운동 분할 방식을 선택해주세요."); return; }
    if (splitType === "3split" && splitOrder.length !== 3) { setErr("3분할 순환 순서를 3개 모두 순서대로 선택해주세요."); return; }
    onComplete({
      gender, age, height, weight, pain, goals, splitType,
      splitOrder: splitType === "3split" ? splitOrder : SPLIT_CATEGORIES,
    });
  }

  const chip = (active) => ({
    padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${active ? "#1B64F2" : "#E4E7EC"}`,
    background: active ? "#EAF1FF" : "#FFFFFF", color: active ? "#1B64F2" : "#55585F",
  });
  const input = { border: "1px solid #E4E7EC", borderRadius: 10, padding: "10px 12px", fontSize: 14, width: "100%", color: "#14161A" };
  const label = { fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FA", fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#1B64F2", fontWeight: 800, marginBottom: 4 }}>WELCOME</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#14161A", marginBottom: 6 }}>먼저 님을 좀 알아야겠어요</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, lineHeight: 1.5 }}>
          기본 정보를 입력하면 통증 부위와 목표에 맞춰 안내하고, 분할 방식에 맞게 다음 운동 부위를 자동으로 추천해드려요.
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={label}>성별</span>
              <div style={{ display: "flex", gap: 6 }}>
                {["남성", "여성"].map(g => <button key={g} onClick={() => setGender(g)} style={chip(gender === g)}>{g}</button>)}
              </div>
            </div>
            <div>
              <span style={label}>나이</span>
              <input style={input} type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="43" />
            </div>
            <div>
              <span style={label}>신장(cm)</span>
              <input style={input} type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="172" />
            </div>
            <div>
              <span style={label}>체중(kg)</span>
              <input style={input} type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="77" />
            </div>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <span style={label}>현재 통증/주의 부위 (복수 선택)</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PAIN_OPTIONS.map(p => <button key={p} onClick={() => toggle(pain, setPain, p)} style={chip(pain.includes(p))}>{p}</button>)}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <span style={label}>운동 목표 (복수 선택)</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GOAL_OPTIONS.map(g => <button key={g} onClick={() => toggle(goals, setGoals, g)} style={chip(goals.includes(g))}>{g}</button>)}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <span style={label}>현재 주로 하는 분할 방식</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: splitType === "3split" ? 14 : 0 }}>
            {SPLIT_OPTIONS.map(o => (
              <button key={o.id} onClick={() => { setSplitType(o.id); setSplitOrder([]); }}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${splitType === o.id ? "#1B64F2" : "#E4E7EC"}`,
                  background: splitType === o.id ? "#EAF1FF" : "#FFFFFF",
                }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#14161A" }}>{o.label}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{o.desc}</div>
              </button>
            ))}
          </div>
          {splitType === "3split" && (
            <div>
              <span style={label}>순환 순서대로 탭하세요 (1→2→3)</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SPLIT_CATEGORIES.map(c => {
                  const idx = splitOrder.indexOf(c);
                  return (
                    <button key={c} onClick={() => toggleSplitOrder(c)} style={chip(idx > -1)}>
                      {idx > -1 ? `${idx + 1}. ` : ""}{c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {err && <div style={{ color: "#E0483F", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button onClick={submit} style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: "#1B64F2", color: "#FFFFFF", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          시작하기
        </button>
      </div>
    </div>
  );
}

// ============ login screen ============
function Login({ onSignIn, signingIn, error }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FA", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#1B64F2", fontWeight: 800, marginBottom: 8 }}>SELF-PT LOG</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#14161A", marginBottom: 6 }}>운동 기록</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, lineHeight: 1.5 }}>
          구글 계정으로 로그인하면 어떤 기기에서든 같은 기록을 이어볼 수 있어요.
        </div>
        <button onClick={onSignIn} disabled={signingIn}
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "1px solid #E4E7EC", background: "#FFFFFF", color: "#14161A", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {signingIn ? <Loader2 className="animate-spin" size={18} /> : "구글로 로그인"}
        </button>
        {error && <div style={{ color: "#E0483F", fontSize: 13, marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

// ============ main component ============
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [data, setData] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("log");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [weekAnchor, setWeekAnchor] = useState(todayStr());
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [copyState, setCopyState] = useState("idle");

  const [category, setCategory] = useState(CATEGORY_ORDER[0]);
  const [customCategory, setCustomCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [exercise, setExercise] = useState("");
  const [note, setNote] = useState("");
  const [sets, setSets] = useState([{ weight: "", reps: "" }]);
  const [editingId, setEditingId] = useState(null);

  // watch Google sign-in state; once signed in, load this account's data from Firestore
  useEffect(() => {
    const unsubscribe = subscribeAuth(async (fbUser) => {
      setUser(fbUser || null);
      if (!fbUser) { setLoading(false); return; }
      setUid(fbUser.uid);
      setLoading(true);
      try {
        const [d, p] = await Promise.all([
          storage.get("workout-log").catch(() => null),
          storage.get("user-profile").catch(() => null),
        ]);
        setData(d && d.value ? JSON.parse(d.value) : {});
        setProfile(p && p.value ? JSON.parse(p.value) : null);
      } catch {
        setData({}); setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function handleSignIn() {
    setSigningIn(true); setAuthError("");
    try { await signInWithGoogle(); }
    catch { setAuthError("로그인에 실패했어요. Firebase 콘솔에서 Google 로그인이 활성화되어 있는지 확인해주세요."); }
    finally { setSigningIn(false); }
  }

  async function handleSignOut() {
    await signOutUser();
    setData({}); setProfile(null); setShowSettings(false);
  }

  async function persist(next) {
    setData(next); setSaving(true); setError("");
    try {
      const ok = await storage.set("workout-log", JSON.stringify(next));
      if (!ok) setError("저장에 실패했어요. 다시 시도해주세요.");
    } catch { setError("저장 중 오류가 발생했어요. 네트워크를 확인해주세요."); }
    finally { setSaving(false); }
  }

  async function saveProfile(p) {
    setProfile(p);
    try { await storage.set("user-profile", JSON.stringify(p)); } catch { /* noop */ }
    if (p.splitType === "3split" && p.splitOrder && p.splitOrder.length === 3) setCategory(p.splitOrder[0]);
    setShowSettings(false);
  }

  const activeCategory = customCategory ? (categoryInput || "기타") : category;
  const isCardio = activeCategory === "유산소";
  const isCore = activeCategory === "코어";

  const exerciseSuggestions = useMemo(() => {
    const set = new Set(EXERCISE_DB[activeCategory] || []);
    Object.values(data).forEach(list => list.forEach(e => { if (e.category === activeCategory) set.add(e.exercise); }));
    return Array.from(set);
  }, [data, activeCategory]);

  const lastMatching = useMemo(() => {
    if (!exercise.trim()) return null;
    const dates = Object.keys(data).filter(d => d <= selectedDate).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] === selectedDate) continue;
      const found = (data[dates[i]] || []).find(e => e.category === activeCategory && e.exercise === exercise.trim());
      if (found) return { ...found, date: dates[i] };
    }
    return null;
  }, [data, exercise, activeCategory, selectedDate]);

  const recommended = useMemo(() => nextRecommendedCategory(data, profile), [data, profile]);
  const cautions = (profile?.pain || []).filter(p => (CAUTION_MAP[p] || []).includes(activeCategory));

  function resetForm() { setExercise(""); setNote(""); setSets([{ weight: "", reps: "" }]); setEditingId(null); }
  function updateSet(i, field, val) { setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s)); }
  function addSetRow() { setSets(prev => [...prev, { weight: "", reps: "" }]); }
  function removeSetRow(i) { setSets(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev); }

  async function saveEntry() {
    const ex = exercise.trim();
    if (!ex) { setError("운동 이름을 입력해주세요."); return; }
    const cleanSets = sets.filter(s => (s.reps || "").toString().trim() !== "");
    if (cleanSets.length === 0) { setError("최소 한 세트는 입력해주세요."); return; }
    const entry = { id: editingId || uid(), category: activeCategory, exercise: ex, sets: cleanSets, note: note.trim() };
    const dayList = data[selectedDate] ? [...data[selectedDate]] : [];
    const nextList = editingId ? dayList.map(e => e.id === editingId ? entry : e) : [...dayList, entry];
    await persist({ ...data, [selectedDate]: nextList });
    resetForm();
  }

  function loadForEdit(entry) {
    setEditingId(entry.id);
    if (CATEGORY_ORDER.includes(entry.category)) { setCategory(entry.category); setCustomCategory(false); }
    else { setCustomCategory(true); setCategoryInput(entry.category); }
    setExercise(entry.exercise); setNote(entry.note || "");
    setSets(entry.sets.length ? entry.sets : [{ weight: "", reps: "" }]);
  }

  async function deleteEntry(id) {
    await persist({ ...data, [selectedDate]: (data[selectedDate] || []).filter(e => e.id !== id) });
  }

  async function handleImport() {
    const { result, count } = parseImportText(importText);
    if (count === 0) { setImportMsg("인식된 기록이 없어요. 형식을 확인해주세요."); return; }
    const merged = { ...data };
    Object.entries(result).forEach(([d, list]) => { merged[d] = merged[d] ? [...merged[d], ...list] : list; });
    await persist(merged);
    setImportMsg(`${count}개 기록을 가져왔어요.`); setImportText("");
  }

  async function clearAll() {
    if (!window.confirm("모든 운동 기록을 삭제할까요? 이 작업은 되돌릴 수 없어요.")) return;
    await persist({});
  }

  const todaysEntries = data[selectedDate] || [];
  const curWeekDates = useMemo(() => weekDates(weekAnchor), [weekAnchor]);
  const prevWeekDates = useMemo(() => weekDates(addDays(curWeekDates[0], -7)), [curWeekDates]);
  const curEntries = useMemo(() => flattenRange(data, curWeekDates), [data, curWeekDates]);
  const prevEntries = useMemo(() => flattenRange(data, prevWeekDates), [data, prevWeekDates]);
  const curAgg = useMemo(() => aggregateByCategory(curEntries), [curEntries]);
  const prevAgg = useMemo(() => aggregateByCategory(prevEntries), [prevEntries]);
  const missing = SPLIT_CATEGORIES.filter(c => !(curAgg[c] > 0));

  const copyBlock = useMemo(() => {
    const lines = [];
    curWeekDates.forEach(d => {
      const list = data[d] || []; if (list.length === 0) return;
      list.forEach(e => lines.push(`${d} ${e.category} ${e.exercise} ${setsToStr(e.sets, e.category)}`));
      lines.push("");
    });
    return lines.join("\n").trim();
  }, [data, curWeekDates]);

  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(copyBlock); setCopyState("copied"); }
    catch { setCopyState("failed"); }
    setTimeout(() => setCopyState("idle"), 1600);
  }

  const wrap = { minHeight: "100vh", background: "#F7F8FA", color: "#14161A", fontFamily: FONT, paddingBottom: 40 };
  const inputStyle = { background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, color: "#14161A", padding: "9px 11px", fontSize: 14, width: "100%" };
  const card = { background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 14, padding: 14, marginBottom: 16 };
  const sectionLabel = { fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 };
  const tabBtn = (active) => ({ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, background: active ? "#1B64F2" : "#FFFFFF", color: active ? "#FFFFFF" : "#6B7280", boxShadow: active ? "none" : "inset 0 0 0 1px #E4E7EC" });

  if (user === undefined) return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={26} color="#1B64F2" /></div>;
  if (user === null) return <Login onSignIn={handleSignIn} signingIn={signingIn} error={authError} />;
  if (loading) return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={26} color="#1B64F2" /></div>;
  if (!profile || showSettings) return <Onboarding onComplete={saveProfile} />;

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#1B64F2", fontWeight: 800 }}>SELF-PT LOG</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>운동 기록</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user?.email && <span style={{ fontSize: 11, color: "#9AA1AC", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>}
            <button onClick={() => setShowSettings(true)} style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, padding: 8, cursor: "pointer" }}>
              <Settings size={16} color="#6B7280" />
            </button>
            <button onClick={handleSignOut} style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, padding: "8px 10px", cursor: "pointer", fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
              로그아웃
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button style={tabBtn(view === "log")} onClick={() => setView("log")}>기록 입력</button>
          <button style={tabBtn(view === "week")} onClick={() => setView("week")}>이번주 정리</button>
        </div>

        {error && <div style={{ background: "#FBEAE8", border: "1px solid #E0483F", color: "#B23A2E", padding: "8px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {view === "log" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={() => setSelectedDate(d => addDays(d, -1))} style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, padding: 8 }}><ChevronLeft size={16} /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>{selectedDate}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{weekdayKR(selectedDate)}요일</div>
              </div>
              <button onClick={() => setSelectedDate(d => addDays(d, 1))} style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, padding: 8 }}><ChevronRight size={16} /></button>
            </div>
            {selectedDate !== todayStr() && (
              <button onClick={() => setSelectedDate(todayStr())} style={{ background: "none", border: "none", color: "#1B64F2", fontSize: 12, marginBottom: 12, cursor: "pointer", display: "block" }}>오늘로 이동</button>
            )}

            {recommended && todaysEntries.length === 0 && (
              <button onClick={() => { setCategory(recommended); setCustomCategory(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "#EAF1FF", border: "1px solid #C7DBFB", borderRadius: 10, padding: "10px 12px", marginBottom: 14, cursor: "pointer" }}>
                <Sparkles size={14} color="#1B64F2" />
                <span style={{ fontSize: 13, color: "#1B64F2" }}><b>오늘 추천 부위: {recommended}</b> · 분할 순환상 다음 차례예요</span>
              </button>
            )}

            <div style={card}>
              <div style={sectionLabel}>{editingId ? "기록 수정" : "새 기록 추가"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {CATEGORY_ORDER.map(c => (
                  <button key={c} onClick={() => { setCategory(c); setCustomCategory(false); }}
                    style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${!customCategory && category === c ? CATEGORY_STYLE[c].text : "#E4E7EC"}`, background: !customCategory && category === c ? CATEGORY_STYLE[c].bg : "#FFFFFF", color: !customCategory && category === c ? CATEGORY_STYLE[c].text : "#6B7280" }}>
                    {c}
                  </button>
                ))}
                <button onClick={() => setCustomCategory(true)} style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px dashed #9AA1AC", background: customCategory ? "#F1F2F4" : "#FFFFFF", color: "#6B7280" }}>+ 직접입력</button>
              </div>
              {customCategory && <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="부위명 입력 (예: 재활)" value={categoryInput} onChange={e => setCategoryInput(e.target.value)} />}

              {cautions.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF6E9", border: "1px solid #F1D9A8", borderRadius: 8, padding: "7px 10px", marginBottom: 10, fontSize: 12, color: "#96690F" }}>
                  <AlertTriangle size={13} /> {cautions.join(", ")} 통증 부위 — 가동범위·중량 무리하지 마세요
                </div>
              )}

              <input list="exercise-suggestions" style={{ ...inputStyle, marginBottom: 6 }} placeholder="운동 이름" value={exercise} onChange={e => setExercise(e.target.value)} />
              <datalist id="exercise-suggestions">{exerciseSuggestions.map(s => <option value={s} key={s} />)}</datalist>

              {lastMatching && (
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10, fontFamily: MONO }}>
                  직전({lastMatching.date.slice(5)}): {setsToStr(lastMatching.sets, lastMatching.category)}
                </div>
              )}

              {sets.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  {!isCardio && !isCore && <input style={{ ...inputStyle, width: "40%" }} placeholder="무게" value={s.weight} onChange={e => updateSet(i, "weight", e.target.value)} />}
                  <input style={inputStyle} placeholder={isCardio ? "시간 (예: 20분)" : "횟수"} value={s.reps} onChange={e => updateSet(i, "reps", e.target.value)} />
                  {sets.length > 1 && <button onClick={() => removeSetRow(i)} style={{ background: "none", border: "none", color: "#9AA1AC", cursor: "pointer" }}><X size={16} /></button>}
                </div>
              ))}
              {!isCardio && <button onClick={addSetRow} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#1B64F2", fontSize: 13, cursor: "pointer", marginBottom: 10 }}><Plus size={14} /> 세트 추가</button>}

              <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="특이사항 (선택)" value={note} onChange={e => setNote(e.target.value)} />

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEntry} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#1B64F2", color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }}>
                  {saving ? "저장 중…" : editingId ? "수정 저장" : "기록 저장"}
                </button>
                {editingId && <button onClick={resetForm} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #E4E7EC", background: "#FFFFFF", color: "#6B7280", cursor: "pointer" }}>취소</button>}
              </div>
            </div>

            <div style={sectionLabel}>이 날 기록 ({todaysEntries.length})</div>
            {todaysEntries.length === 0 && <div style={{ color: "#9AA1AC", fontSize: 13, marginBottom: 20 }}>아직 기록이 없어요. 위에서 추가해보세요.</div>}
            {todaysEntries.map(e => {
              let prev = null;
              for (const d of Object.keys(data).sort().reverse()) {
                if (d >= selectedDate) continue;
                const f = (data[d] || []).find(x => x.category === e.category && x.exercise === e.exercise);
                if (f) { prev = f; break; }
              }
              const isPR = prev && maxWeight(e.sets) > maxWeight(prev.sets);
              return (
                <div key={e.id} style={{ ...card, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <Tag text={e.category} style={CATEGORY_STYLE[e.category] || CATEGORY_STYLE["기타"]} />
                      {isPR && <Tag text="PR" style={{ text: "#96690F", bg: "#FBF1DF" }} />}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.exercise}</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: "#374151" }}>{setsToStr(e.sets, e.category)}</div>
                    {e.note && <div style={{ fontSize: 12, color: "#9AA1AC", marginTop: 2 }}>{e.note}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => loadForEdit(e)} style={{ background: "none", border: "none", color: "#9AA1AC", cursor: "pointer" }}><Pencil size={15} /></button>
                    <button onClick={() => deleteEntry(e.id)} style={{ background: "none", border: "none", color: "#9AA1AC", cursor: "pointer" }}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: 20 }}>
              <button onClick={() => setShowImport(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6B7280", fontSize: 12, cursor: "pointer" }}>
                <Upload size={13} /> 기존 텍스트 기록 가져오기
              </button>
              {showImport && (
                <div style={{ marginTop: 8 }}>
                  <textarea rows={5} style={{ ...inputStyle, fontFamily: MONO, fontSize: 12 }} placeholder="2026-07-13 하체&어깨 레그익스텐션 50x20/80x14 ..." value={importText} onChange={e => setImportText(e.target.value)} />
                  <button onClick={handleImport} style={{ marginTop: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #1B64F2", background: "#FFFFFF", color: "#1B64F2", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>가져오기</button>
                  {importMsg && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>{importMsg}</div>}
                </div>
              )}
            </div>
            <button onClick={clearAll} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#9AA1AC", fontSize: 12, cursor: "pointer" }}><RotateCcw size={12} /> 전체 기록 초기화</button>
          </>
        )}

        {view === "week" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setWeekAnchor(d => addDays(d, -7))} style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, padding: 8 }}><ChevronLeft size={16} /></button>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{curWeekDates[0]} ~ {curWeekDates[6].slice(5)}</div>
              <button onClick={() => setWeekAnchor(d => addDays(d, 7))} style={{ background: "#FFFFFF", border: "1px solid #E4E7EC", borderRadius: 10, padding: 8 }}><ChevronRight size={16} /></button>
            </div>

            <div style={card}>
              <div style={sectionLabel}>부위별 볼륨</div>
              {CATEGORY_ORDER.map(c => <VolumeBar key={c} label={c} value={curAgg[c]} prevValue={prevAgg[c]} unit={CATEGORY_UNIT[c]} style={CATEGORY_STYLE[c]} />)}
            </div>

            {missing.length > 0 && (
              <div style={{ background: "#FFF6E9", border: "1px solid #F1D9A8", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "#96690F" }}>
                <b>부족했던 부위:</b> {missing.join(", ")}
              </div>
            )}

            <div style={sectionLabel}>이번주 기록표</div>
            <div style={{ border: "1px solid #E4E7EC", borderRadius: 12, overflow: "hidden", marginBottom: 20, background: "#FFFFFF" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#F7F8FA" }}>
                  <th style={{ padding: 8, textAlign: "left" }}>날짜</th><th style={{ padding: 8, textAlign: "left" }}>운동</th><th style={{ padding: 8, textAlign: "left" }}>중량x반복</th><th style={{ padding: 8, textAlign: "left" }}>특이사항</th>
                </tr></thead>
                <tbody>
                  {curEntries.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: "#9AA1AC", textAlign: "center" }}>이번주 기록이 없어요</td></tr>}
                  {curEntries.map(e => (
                    <tr key={e.id} style={{ borderTop: "1px solid #EEF0F3" }}>
                      <td style={{ padding: 8, fontFamily: MONO }}>{e.date.slice(5)}</td>
                      <td style={{ padding: 8 }}>{e.exercise}</td>
                      <td style={{ padding: 8, fontFamily: MONO }}>{setsToStr(e.sets, e.category)}</td>
                      <td style={{ padding: 8, color: "#9AA1AC" }}>{e.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={sectionLabel}>복사용 요약 블록</div>
            <textarea readOnly value={copyBlock || "이번주 기록이 없어요"} rows={8} style={{ ...inputStyle, fontFamily: MONO, fontSize: 12, marginBottom: 8 }} />
            <button onClick={copyToClipboard} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #1B64F2", background: "#FFFFFF", color: "#1B64F2", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
              {copyState === "copied" ? "복사됨" : copyState === "failed" ? "복사 실패 — 직접 선택해 복사하세요" : "복사하기"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
