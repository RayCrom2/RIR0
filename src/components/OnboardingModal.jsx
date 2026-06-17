import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import FoodImportModal from "./FoodImportModal";

const MACRO_FIELDS = [
  { key: "calories", minKey: "calories_min", dirKey: "calories_dir", label: "Calories", unit: "kcal", color: "#ff8c42", defaultDir: "below" },
  { key: "protein",  minKey: "protein_min",  dirKey: "protein_dir",  label: "Protein",  unit: "g",    color: "#4f8ef7", defaultDir: "above" },
  { key: "carbs",    minKey: "carbs_min",    dirKey: "carbs_dir",    label: "Carbs",    unit: "g",    color: "#f7c948", defaultDir: "below" },
  { key: "fat",      minKey: "fat_min",      dirKey: "fat_dir",      label: "Fat",      unit: "g",    color: "#e05c5c", defaultDir: "below" },
  { key: "fiber",    minKey: "fiber_min",    dirKey: "fiber_dir",    label: "Fiber",    unit: "g",    color: "#5cb85c", defaultDir: "above" },
  { key: "sugar",    minKey: "sugar_min",    dirKey: "sugar_dir",    label: "Sugar",    unit: "g",    color: "#c87dd4", defaultDir: "below" },
];

const GOALS = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "lose_fat",    label: "Lose fat"     },
  { value: "maintain",    label: "Maintain"     },
  { value: "gain_muscle", label: "Gain muscle"  },
  { value: "gain_weight", label: "Gain weight"  },
];

const EXPERIENCE = [
  { value: "beginner",     label: "Beginner"     },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced",     label: "Advanced"     },
];

export function packMacros(flat) {
  const m = {};
  MACRO_FIELDS.forEach(f => {
    m[f.key] = { target: flat[f.key] ?? null, min: flat[f.minKey] ?? null, dir: flat[f.dirKey] ?? f.defaultDir };
  });
  return m;
}

export function unpackMacros(json) {
  const src = json || {};
  const out = {};
  MACRO_FIELDS.forEach(f => {
    const m = src[f.key] || {};
    out[f.key]    = m.target ?? null;
    out[f.minKey] = m.min    ?? null;
    out[f.dirKey] = m.dir    ?? f.defaultDir;
  });
  return out;
}

export const GOAL_GROUPS = {
  lose:     ["lose_weight", "lose_fat"],
  maintain: ["maintain"],
  gain:     ["gain_muscle", "gain_weight"],
};

export const ACTIVITY_LEVELS = [
  { value: "sedentary",   label: "Sedentary",          desc: "Desk job, little or no exercise",      multiplier: 1.2   },
  { value: "light",       label: "Lightly Active",      desc: "1–3 days exercise per week",           multiplier: 1.375 },
  { value: "moderate",    label: "Moderately Active",   desc: "3–5 days exercise per week",           multiplier: 1.55  },
  { value: "active",      label: "Very Active",         desc: "6–7 days exercise per week",           multiplier: 1.725 },
  { value: "very_active", label: "Extremely Active",    desc: "Physical job or training twice daily", multiplier: 1.9   },
];

export const DEFICIT_SEVERITY = [
  { value: "minor",      label: "Minor",      desc: "100–200 kcal deficit · ~0.4–0.6 lbs/week", delta: -150 },
  { value: "moderate",   label: "Moderate",   desc: "300–400 kcal deficit · ~0.6–1.0 lbs/week", delta: -350 },
  { value: "aggressive", label: "Aggressive", desc: "500–750 kcal deficit · ~1.0–1.5 lbs/week", delta: -600 },
];

export const SURPLUS_SEVERITY = [
  { value: "minor",      label: "Minor",      desc: "+100–200 kcal · ~0.25 lbs/week gain", delta: 150 },
  { value: "moderate",   label: "Moderate",   desc: "+200–350 kcal · ~0.5 lbs/week gain",  delta: 275 },
  { value: "aggressive", label: "Aggressive", desc: "+350–500 kcal · ~1.0 lbs/week gain",  delta: 425 },
];

function getGoalGroup(val) {
  for (const [group, vals] of Object.entries(GOAL_GROUPS)) {
    if (vals.includes(val)) return group;
  }
  return null;
}

export function applyGoalToggle(current, val) {
  const group = getGoalGroup(val);
  if (current.includes(val)) return current.filter(g => g !== val);
  if (group === "maintain") return [val];
  // Keep only same-group goals, add new one
  return [...current.filter(g => getGoalGroup(g) === group), val];
}

export function calcSuggested({ gender, age, date_of_birth, height_cm, weight_kg, body_composition_goals, activity_level, deficitSeverity, surplusSeverity }) {
  const a = date_of_birth ? getAge(date_of_birth) : Number(age);
  if (!weight_kg || !height_cm || !a) return null;
  const w = Number(weight_kg), h = Number(height_cm);
  const bmr = gender === "male"
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
  const actMult = ACTIVITY_LEVELS.find(l => l.value === activity_level)?.multiplier ?? 1.55;
  const tdee = Math.round(bmr * actMult);
  const goals = body_composition_goals ?? [];
  const isLoss = goals.some(g => ["lose_weight", "lose_fat"].includes(g));
  const isGain = goals.some(g => ["gain_muscle", "gain_weight"].includes(g));
  let delta = 0;
  if (isLoss) delta = DEFICIT_SEVERITY.find(s => s.value === deficitSeverity)?.delta ?? -350;
  else if (isGain) delta = SURPLUS_SEVERITY.find(s => s.value === surplusSeverity)?.delta ?? 275;
  const calories = Math.round((tdee + delta) / 50) * 50;
  const proteinPerKg = isLoss ? 2.2 : isGain ? 2.0 : 1.6;
  const protein = Math.round(w * proteinPerKg);
  // Fat: range from 20% of calories (hormone floor) to 35% (upper limit)
  const fatMin = Math.round(calories * 0.20 / 9);
  const fat = Math.round(calories * 0.35 / 9);
  // Use 28% fat midpoint for carb calculation so carbs stay reasonable
  const fatMid = Math.round(calories * 0.28 / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fatMid * 9) / 4));
  // Fiber: range from 14g/1000 kcal floor to 21g/1000 kcal ceiling (cap 50g)
  const fiberMin = Math.round(calories / 1000 * 14);
  const fiber = Math.min(50, Math.round(calories / 1000 * 21));
  // Sugar: ≤ 8% of calories from sugar, clamped 25–50g
  const sugar = Math.round(Math.min(50, Math.max(25, calories * 0.08 / 4)));
  return {
    calories, calories_dir: isGain ? "above" : "below", calories_min: null,
    protein,  protein_dir: "above",                      protein_min: null,
    carbs,    carbs_dir: "below",                        carbs_min: null,
    fat,      fat_min: fatMin,
    fiber,    fiber_min: fiberMin,
    sugar,    sugar_dir: "below",                        sugar_min: null,
  };
}

const isMobileDevice = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function toDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

function parseDisplayDate(raw) {
  const v = raw.trim();
  if (!v) return "";
  // MM/DD/YYYY or MM-DD-YYYY (with separators)
  const mdy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = v.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  // MMDDYYYY (8 digits, no separators)
  const d8 = v.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (d8) return `${d8[3]}-${d8[1]}-${d8[2]}`;
  // MDDYYYY (7 digits, single-digit month)
  const d7 = v.match(/^(\d{1})(\d{2})(\d{4})$/);
  if (d7) return `${d7[3]}-${d7[1].padStart(2, "0")}-${d7[2]}`;
  return "";
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(m, y) {
  return new Date(y || 2000, m, 0).getDate();
}

function MobileSelectDOB({ value, onChange }) {
  const [year, setYear] = useState(() => (value ? value.split("-")[0] : "") || "");
  const [month, setMonth] = useState(() => {
    const p = value?.split("-");
    return p?.[1] ? String(Number(p[1])) : "";
  });
  const [day, setDay] = useState(() => {
    const p = value?.split("-");
    return p?.[2] ? String(Number(p[2])) : "";
  });

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-");
      setYear(y || "");
      setMonth(m ? String(Number(m)) : "");
      setDay(d ? String(Number(d)) : "");
    } else {
      setYear(""); setMonth(""); setDay("");
    }
  }, [value]);

  const maxDay = daysInMonth(Number(month), Number(year));
  const effectiveDay = day && Number(day) > maxDay ? "" : day;
  const currentYear = new Date().getFullYear();

  function emit(y, m, d) {
    if (y && m && d)
      onChange(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const sel = {
    flex: 1, minWidth: 0,
    padding: "7px 4px", fontSize: 14,
    border: "1px solid #e0e0e0", borderRadius: 8,
    background: "#fafafa", outline: "none", cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", gap: 4, flex: 1 }}>
      <select value={month} style={{ ...sel, flex: 3 }}
        onChange={e => { setMonth(e.target.value); emit(year, e.target.value, effectiveDay); }}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => <option key={i + 1} value={String(i + 1)}>{name}</option>)}
      </select>
      <select value={effectiveDay} style={{ ...sel, flex: 1.5 }}
        onChange={e => { setDay(e.target.value); emit(year, month, e.target.value); }}>
        <option value="">Day</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
          <option key={d} value={String(d)}>{d}</option>
        ))}
      </select>
      <select value={year} style={{ ...sel, flex: 2 }}
        onChange={e => { setYear(e.target.value); emit(e.target.value, month, effectiveDay); }}>
        <option value="">Year</option>
        {Array.from({ length: 100 }, (_, i) => currentYear - i).map(y => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

export function BirthDateInput({ value, onChange, style }) {
  const [mobile] = useState(isMobileDevice);
  const [text, setText] = useState(() => toDisplayDate(value));

  useEffect(() => { setText(toDisplayDate(value)); }, [value]);

  if (mobile) {
    return <MobileSelectDOB value={value ?? ""} onChange={onChange} />;
  }

  return (
    <input
      type="text"
      value={text}
      placeholder="MM/DD/YYYY"
      onChange={e => setText(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={() => {
        const iso = parseDisplayDate(text);
        if (iso) { onChange(iso); setText(toDisplayDate(iso)); }
        else if (!text.trim()) onChange("");
      }}
      style={style}
    />
  );
}

export function getAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 ? age : null;
}

function cmToFtIn(cm) {
  const totalIn = Number(cm) / 2.54;
  return { ft: Math.floor(totalIn / 12), in: Math.round(totalIn % 12) };
}
function ftInToCm(ft, inch) {
  return Math.round((Number(ft || 0) * 12 + Number(inch || 0)) * 2.54);
}
function kgToLbs(kg) { return Math.round(Number(kg) * 2.20462); }
function lbsToKg(lbs) { return Math.round(Number(lbs) / 2.20462 * 10) / 10; }

export default function OnboardingModal() {
  const { user, needsOnboarding, setNeedsOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [profile, setProfile] = useState({
    gender: "male", date_of_birth: "", height_cm: "", weight_kg: "",
    experience_level: "beginner",
    body_composition_goals: ["maintain"],
    activity_level: "moderate",
  });

  const [heightUnit, setHeightUnit] = useState("cm");
  const [ftIn, setFtIn] = useState({ ft: "", in: "" });
  const [weightUnit, setWeightUnit] = useState("kg");
  const [lbsVal, setLbsVal] = useState("");

  const [deficitSeverity, setDeficitSeverity] = useState("moderate");
  const [surplusSeverity, setSurplusSeverity] = useState("moderate");

  const [macros, setMacros] = useState({
    calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 25, sugar: 50,
    calories_min: null, protein_min: null, carbs_min: null,
    fat_min: null, fiber_min: null, sugar_min: null,
    calories_dir: "below", protein_dir: "above", carbs_dir: "below",
    fat_dir: "below", fiber_dir: "above", sugar_dir: "below",
  });
  const [rangeEnabled, setRangeEnabled] = useState({});

  if (!needsOnboarding) return null;

  const isLoss = profile.body_composition_goals.some(g => ["lose_weight", "lose_fat"].includes(g));
  const isGain = profile.body_composition_goals.some(g => ["gain_muscle", "gain_weight"].includes(g));

  function applySuggested(overrideDeficit, overrideSurplus) {
    const calc = calcSuggested({
      ...profile,
      deficitSeverity: overrideDeficit ?? deficitSeverity,
      surplusSeverity: overrideSurplus ?? surplusSeverity,
    });
    if (calc) {
      setMacros(m => ({ ...m, ...calc }));
      setRangeEnabled(r => ({ ...r, calories: false, protein: false, carbs: false, fat: true, fiber: true, sugar: false }));
    }
  }

  function setP(key, val) { setProfile(p => ({ ...p, [key]: val })); }
  function setM(key, val) {
    setMacros(m => ({ ...m, [key]: val === "" ? null : Number(val) }));
    if (isLoss) setDeficitSeverity("custom");
    else if (isGain) setSurplusSeverity("custom");
  }
  function toggleRange(key) {
    setRangeEnabled(r => ({ ...r, [key]: !r[key] }));
    if (rangeEnabled[key]) setMacros(m => ({ ...m, [`${key}_min`]: null }));
  }

  function toggleHeightUnit(unit) {
    if (unit === "ftin" && heightUnit === "cm") {
      if (profile.height_cm) { const c = cmToFtIn(profile.height_cm); setFtIn({ ft: String(c.ft), in: String(c.in) }); }
    } else if (unit === "cm" && heightUnit === "ftin") {
      const cm = ftInToCm(ftIn.ft, ftIn.in); if (cm) setP("height_cm", String(cm));
    }
    setHeightUnit(unit);
  }
  function handleFtIn(field, val) {
    const next = { ...ftIn, [field]: val };
    setFtIn(next);
    setP("height_cm", String(ftInToCm(next.ft, next.in)));
  }
  function toggleWeightUnit(unit) {
    if (unit === "lbs" && weightUnit === "kg") {
      if (profile.weight_kg) setLbsVal(String(kgToLbs(profile.weight_kg)));
    } else if (unit === "kg" && weightUnit === "lbs") {
      const kg = lbsToKg(lbsVal); if (kg) setP("weight_kg", String(kg));
    }
    setWeightUnit(unit);
  }
  function handleLbs(val) {
    setLbsVal(val);
    setP("weight_kg", String(lbsToKg(val)));
  }

  async function handleSave() {
    setSaving(true);
    const { gender, date_of_birth, height_cm, weight_kg, ...goalProfile } = profile;
    const weightKg = Number(weight_kg) || null;
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    await Promise.all([
      supabase.from("nutrition_goals").upsert(
        {
          user_id: user.id,
          macros: packMacros(macros),
          body_composition_goals: goalProfile.body_composition_goals,
          activity_level: goalProfile.activity_level,
          experience_level: goalProfile.experience_level,
        },
        { onConflict: "user_id" }
      ),
      supabase.from("user_info").upsert(
        { user_id: user.id, gender, date_of_birth, height_cm, weight_kg, starting_weight_kg: weightKg },
        { onConflict: "user_id" }
      ),
      supabase.from("user_preferences").upsert(
        { user_id: user.id, preferred_weight_unit: weightUnit, preferred_height_unit: heightUnit },
        { onConflict: "user_id" }
      ),
    ]);
    if (weightKg) {
      await supabase.from("weight_logs").upsert(
        { user_id: user.id, date: todayStr, weight_kg: weightKg },
        { onConflict: "user_id,date" }
      );
    }
    setNeedsOnboarding(false);
    setSaving(false);
  }

  const canNext1 = profile.date_of_birth && profile.height_cm && profile.weight_kg;
  const suggested = calcSuggested({ ...profile, deficitSeverity, surplusSeverity });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        padding: "28px 24px", width: "100%", maxWidth: 460,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Step indicators */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? "#ff8c42" : "#f0f0f0",
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        {/* ── Step 1: About you ── */}
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>About you</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
              We'll use this to calculate your recommended macros.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {["male", "female", "other"].map(g => (
                    <button key={g} type="button" onClick={() => setP("gender", g)}
                      style={{ ...chipBtn, background: profile.gender === g ? "#ff8c42" : "#f7f7fb", color: profile.gender === g ? "#fff" : "#555" }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>Date of Birth</span>
                  <BirthDateInput
                    value={profile.date_of_birth}
                    onChange={v => setP("date_of_birth", v)}
                    style={{ ...numInput, width: "auto", textAlign: "left" }}
                  />
                </div>
                {profile.date_of_birth && (
                  <p style={{ fontSize: 12, color: "#aaa", margin: "4px 0 0", textAlign: "right" }}>
                    Age: {getAge(profile.date_of_birth)} years
                  </p>
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>Height</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["cm", "ftin"].map(u => (
                      <button key={u} type="button" onClick={() => toggleHeightUnit(u)}
                        style={{ ...unitToggle, background: heightUnit === u ? "#ff8c42" : "#f0f0f0", color: heightUnit === u ? "#fff" : "#888" }}>
                        {u === "ftin" ? "ft/in" : "cm"}
                      </button>
                    ))}
                  </div>
                  {heightUnit === "cm" ? (
                    <input type="number" min="100" max="250" step="0.1" value={profile.height_cm}
                      onChange={e => setP("height_cm", e.target.value)} onFocus={e => e.target.select()} style={numInput} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" min="4" max="8" value={ftIn.ft}
                        onChange={e => handleFtIn("ft", e.target.value)} placeholder="ft" onFocus={e => e.target.select()} style={{ ...numInput, width: 52 }} />
                      <input type="number" min="0" max="11" value={ftIn.in}
                        onChange={e => handleFtIn("in", e.target.value)} placeholder="in" onFocus={e => e.target.select()} style={{ ...numInput, width: 62 }} />
                    </div>
                  )}
                  {heightUnit === "cm" && <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>cm</span>}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>Weight</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["kg", "lbs"].map(u => (
                      <button key={u} type="button" onClick={() => toggleWeightUnit(u)}
                        style={{ ...unitToggle, background: weightUnit === u ? "#ff8c42" : "#f0f0f0", color: weightUnit === u ? "#fff" : "#888" }}>
                        {u}
                      </button>
                    ))}
                  </div>
                  {weightUnit === "kg" ? (
                    <input type="number" min="30" max="300" step="0.1" value={profile.weight_kg}
                      onChange={e => setP("weight_kg", e.target.value)} onFocus={e => e.target.select()} style={numInput} />
                  ) : (
                    <input type="number" min="66" max="660" value={lbsVal}
                      onChange={e => handleLbs(e.target.value)} onFocus={e => e.target.select()} style={numInput} />
                  )}
                  <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{weightUnit}</span>
                </div>
              </div>
            </div>
            <button onClick={() => canNext1 && setStep(2)}
              style={{ ...primaryBtn, marginTop: 24, opacity: canNext1 ? 1 : 0.4 }}>
              Next →
            </button>
          </>
        )}

        {/* ── Step 2: Goals ── */}
        {step === 2 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>Your goals</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
              Select all that apply. Compatible goals can be combined.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Fitness goal</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {GOALS.map(g => {
                    const selected = profile.body_composition_goals.includes(g.value);
                    return (
                      <button key={g.value} type="button"
                        onClick={() => setP("body_composition_goals", applyGoalToggle(profile.body_composition_goals, g.value))}
                        style={{ ...chipBtn, justifyContent: "flex-start", padding: "10px 14px", background: selected ? "#fff5ee" : "#f7f7fb", color: selected ? "#ff8c42" : "#555", border: selected ? "1.5px solid #ff8c42" : "1.5px solid transparent", fontWeight: selected ? 700 : 400 }}>
                        <span style={{ flex: 1 }}>{g.label}</span>
                        {selected && <span style={{ fontSize: 13 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Experience level</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {EXPERIENCE.map(e => (
                    <button key={e.value} type="button" onClick={() => setP("experience_level", e.value)}
                      style={{ ...chipBtn, flex: 1, background: profile.experience_level === e.value ? "#ff8c42" : "#f7f7fb", color: profile.experience_level === e.value ? "#fff" : "#555" }}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ ...secondaryBtn, flex: 1 }}>← Back</button>
              <button
                onClick={() => profile.body_composition_goals.length > 0 && setStep(3)}
                style={{ ...primaryBtn, flex: 2, opacity: profile.body_composition_goals.length > 0 ? 1 : 0.4 }}
              >Next →</button>
            </div>
          </>
        )}

        {/* ── Step 3: Activity level ── */}
        {step === 3 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>Activity level</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
              How active are you on a typical week? This sets your calorie burn estimate.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ACTIVITY_LEVELS.map(a => {
                const sel = profile.activity_level === a.value;
                return (
                  <button key={a.value} type="button" onClick={() => setP("activity_level", a.value)}
                    style={{ ...chipBtn, justifyContent: "flex-start", flexDirection: "column", alignItems: "flex-start", padding: "12px 14px", gap: 2, background: sel ? "#fff5ee" : "#f7f7fb", color: sel ? "#ff8c42" : "#555", border: sel ? "1.5px solid #ff8c42" : "1.5px solid transparent", fontWeight: 400 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                    <span style={{ fontSize: 12, color: sel ? "#ff8c42bb" : "#888" }}>{a.desc}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={{ ...secondaryBtn, flex: 1 }}>← Back</button>
              <button onClick={() => { applySuggested(); setStep(4); }} style={{ ...primaryBtn, flex: 2 }}>Next →</button>
            </div>
          </>
        )}

        {/* ── Step 4: Macro targets ── */}
        {step === 4 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>Macro targets</h2>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>
              {suggested ? "We've calculated a starting point — adjust freely." : "Set your daily targets."}
            </p>

            {(isLoss || isGain) && (
              <div style={{ marginTop: 12, marginBottom: 16 }}>
                <p style={{ ...labelStyle, margin: "0 0 6px" }}>
                  {isLoss ? "Deficit intensity" : "Surplus intensity"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {(isLoss ? DEFICIT_SEVERITY : SURPLUS_SEVERITY).map(s => {
                    const active = (isLoss ? deficitSeverity : surplusSeverity) === s.value;
                    return (
                      <button key={s.value} type="button"
                        onClick={() => {
                          const newDef = isLoss ? s.value : deficitSeverity;
                          const newSur = isGain ? s.value : surplusSeverity;
                          if (isLoss) setDeficitSeverity(s.value); else setSurplusSeverity(s.value);
                          applySuggested(newDef, newSur);
                        }}
                        style={{ ...chipBtn, justifyContent: "flex-start", padding: "9px 12px", gap: 8, background: active ? "#fff5ee" : "#f7f7fb", color: active ? "#ff8c42" : "#555", border: active ? "1.5px solid #ff8c42" : "1.5px solid transparent", fontWeight: 400 }}>
                        <span style={{ fontWeight: 700, minWidth: 82, fontSize: 13 }}>{s.label}</span>
                        <span style={{ fontSize: 12, color: active ? "#ff8c42bb" : "#888" }}>{s.desc}</span>
                      </button>
                    );
                  })}
                  {(() => {
                    const active = (isLoss ? deficitSeverity : surplusSeverity) === "custom";
                    return (
                      <button type="button"
                        onClick={() => { if (isLoss) setDeficitSeverity("custom"); else setSurplusSeverity("custom"); }}
                        style={{ ...chipBtn, justifyContent: "flex-start", padding: "9px 12px", gap: 8, background: active ? "#fff5ee" : "#f7f7fb", color: active ? "#ff8c42" : "#555", border: active ? "1.5px solid #ff8c42" : "1.5px solid transparent", fontWeight: 400 }}>
                        <span style={{ fontWeight: 700, minWidth: 82, fontSize: 13 }}>Custom</span>
                        <span style={{ fontSize: 12, color: active ? "#ff8c42bb" : "#888" }}>Manually set below</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {MACRO_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>{f.label}</span>
                    <button type="button" onClick={() => toggleRange(f.key)}
                      style={{ fontSize: 11, color: rangeEnabled[f.key] ? "#ff8c42" : "#aaa", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                      {rangeEnabled[f.key] ? "range ✓" : "+ range"}
                    </button>
                    {rangeEnabled[f.key] ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" min="0" value={macros[f.minKey] ?? ""}
                          onChange={e => setM(f.minKey, e.target.value)}
                          placeholder="min" onFocus={e => e.target.select()} style={{ ...numInput, width: 62 }} />
                        <span style={{ fontSize: 12, color: "#aaa" }}>–</span>
                        <input type="number" min="0" value={macros[f.key] ?? ""}
                          onChange={e => setM(f.key, e.target.value)}
                          placeholder="max" onFocus={e => e.target.select()} style={{ ...numInput, width: 62 }} />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 3 }}>
                          {["below", "above"].map(d => {
                            const active = (macros[f.dirKey] ?? f.defaultDir) === d;
                            return (
                              <button key={d} type="button"
                                onClick={() => setMacros(m => ({ ...m, [f.dirKey]: d }))}
                                style={{ ...unitToggle, background: active ? "#555" : "#f0f0f0", color: active ? "#fff" : "#aaa" }}>
                                {d === "above" ? "≥" : "≤"}
                              </button>
                            );
                          })}
                        </div>
                        <input type="number" min="0" value={macros[f.key] ?? ""}
                          onChange={e => setM(f.key, e.target.value)} onFocus={e => e.target.select()} style={{ ...numInput, width: 80 }} />
                      </>
                    )}
                    <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} style={{ ...secondaryBtn, flex: 1 }}>← Back</button>
              <button onClick={() => setStep(5)}
                style={{ ...primaryBtn, flex: 2 }}>
                Next →
              </button>
            </div>
          </>
        )}

        {/* ── Step 5: Import foods ── */}
        {step === 5 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>Import your foods</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
              Already tracking in another app? Import your food library from Google Sheets, Excel, MyFitnessPal, Cronometer, and more.
            </p>

            <div style={{ background: "#f7f7fb", borderRadius: 12, padding: "18px 16px", marginBottom: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {["📊 Google Sheets", "📁 Excel / CSV", "🍎 MyFitnessPal", "🔬 Cronometer", "📋 Paste data"].map(s => (
                  <span key={s} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#555" }}>{s}</span>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                All imported foods go to your personal food library and are available for logging.
              </p>
            </div>

            <button
              onClick={() => setImportOpen(true)}
              style={{ ...primaryBtn, marginBottom: 10 }}
            >
              Import Foods →
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(4)} style={{ ...secondaryBtn, flex: 1 }}>← Back</button>
              <button onClick={handleSave} disabled={saving}
                style={{ ...secondaryBtn, flex: 2, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Skip, Get Started →"}
              </button>
            </div>

            <FoodImportModal
              open={importOpen}
              onClose={() => setImportOpen(false)}
              onImported={() => { setImportOpen(false); handleSave(); }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, unit, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</span>
      {children}
      <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{unit}</span>
    </div>
  );
}

const unitToggle = { border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 600 };
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#555" };
const numInput = { padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none", textAlign: "right", background: "#fafafa", width: 80 };
const primaryBtn = { background: "#ff8c42", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%" };
const secondaryBtn = { background: "#f7f7fb", color: "#555", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const chipBtn = { border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center" };
