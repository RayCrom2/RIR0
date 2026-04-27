import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const MACRO_FIELDS = [
  { key: "calories", minKey: "calories_min", dirKey: "calories_dir", label: "Calories", unit: "kcal", color: "#ff8c42", defaultDir: "below" },
  { key: "protein",  minKey: "protein_min",  dirKey: "protein_dir",  label: "Protein",  unit: "g",    color: "#4f8ef7", defaultDir: "above" },
  { key: "carbs",    minKey: "carbs_min",    dirKey: "carbs_dir",    label: "Carbs",    unit: "g",    color: "#f7c948", defaultDir: "below" },
  { key: "fat",      minKey: "fat_min",      dirKey: "fat_dir",      label: "Fat",      unit: "g",    color: "#e05c5c", defaultDir: "below" },
  { key: "fiber",    minKey: "fiber_min",    dirKey: "fiber_dir",    label: "Fiber",    unit: "g",    color: "#5cb85c", defaultDir: "above" },
  { key: "sugar",    minKey: "sugar_min",    dirKey: "sugar_dir",    label: "Sugar",    unit: "g",    color: "#c87dd4", defaultDir: "below" },
];

const GOALS = [
  { value: "lose_weight",  label: "Lose weight"  },
  { value: "lose_fat",     label: "Lose fat"      },
  { value: "maintain",     label: "Maintain"      },
  { value: "gain_muscle",  label: "Gain muscle"   },
  { value: "gain_weight",  label: "Gain weight"   },
];

const EXPERIENCE = [
  { value: "beginner",     label: "Beginner"      },
  { value: "intermediate", label: "Intermediate"  },
  { value: "advanced",     label: "Advanced"      },
];

function cmToFtIn(cm) {
  const totalIn = Number(cm) / 2.54;
  return { ft: Math.floor(totalIn / 12), in: Math.round(totalIn % 12) };
}
function ftInToCm(ft, inch) {
  return Math.round((Number(ft || 0) * 12 + Number(inch || 0)) * 2.54);
}
function kgToLbs(kg) { return Math.round(Number(kg) * 2.20462); }
function lbsToKg(lbs) { return Math.round(Number(lbs) / 2.20462 * 10) / 10; }

function calculateMacros({ gender, age, height_cm, weight_kg, fitness_goal }) {
  if (!weight_kg || !height_cm || !age) return null;
  const bmr = gender === "male"
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  const tdee = Math.round(bmr * 1.4);
  const adjust = { lose_weight: -500, lose_fat: -250, maintain: 0, gain_muscle: 200, gain_weight: 500 };
  const calories = Math.round((tdee + (adjust[fitness_goal] ?? 0)) / 50) * 50;
  const proteinPerKg = { lose_weight: 1.8, lose_fat: 2.0, maintain: 1.6, gain_muscle: 2.2, gain_weight: 2.0 };
  const protein = Math.round(weight_kg * (proteinPerKg[fitness_goal] ?? 1.6));
  const fat = Math.round(calories * 0.28 / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round(calories / 1000 * 14);
  return { calories, protein, carbs, fat, fiber, sugar: 50 };
}

export default function OnboardingModal() {
  const { user, needsOnboarding, setNeedsOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    gender: "male", age: "", height_cm: "", weight_kg: "",
    experience_level: "beginner", fitness_goal: "maintain",
  });

  const [heightUnit, setHeightUnit] = useState("cm");
  const [ftIn, setFtIn] = useState({ ft: "", in: "" });
  const [weightUnit, setWeightUnit] = useState("kg");
  const [lbsVal, setLbsVal] = useState("");

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

  const suggested = calculateMacros(profile);
  const [macros, setMacros] = useState({
    calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 25, sugar: 50,
    calories_min: null, protein_min: null, carbs_min: null,
    fat_min: null, fiber_min: null, sugar_min: null,
    calories_dir: "below", protein_dir: "above", carbs_dir: "below",
    fat_dir: "below", fiber_dir: "above", sugar_dir: "below",
  });
  const [rangeEnabled, setRangeEnabled] = useState({});

  if (!needsOnboarding) return null;

  function applysuggested() {
    if (!suggested) return;
    setMacros((m) => ({ ...m, ...suggested }));
  }

  function setP(key, val) { setProfile((p) => ({ ...p, [key]: val })); }
  function setM(key, val) { setMacros((m) => ({ ...m, [key]: val === "" ? null : Number(val) })); }
  function toggleRange(key) {
    setRangeEnabled((r) => ({ ...r, [key]: !r[key] }));
    if (rangeEnabled[key]) setMacros((m) => ({ ...m, [`${key}_min`]: null }));
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("nutrition_goals").upsert(
      { user_id: user.id, ...profile, ...macros },
      { onConflict: "user_id" }
    );
    setNeedsOnboarding(false);
    setSaving(false);
  }

  const canNext1 = profile.age && profile.height_cm && profile.weight_kg;

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
          {[1,2,3].map(s => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? "#ff8c42" : "#f0f0f0",
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        {/* Step 1: About you */}
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
                  {["male","female","other"].map(g => (
                    <button key={g} type="button" onClick={() => setP("gender", g)}
                      style={{ ...chipBtn, background: profile.gender === g ? "#ff8c42" : "#f7f7fb", color: profile.gender === g ? "#fff" : "#555" }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <Row label="Age" unit="yrs">
                <input type="number" min="10" max="100" value={profile.age}
                  onChange={e => setP("age", e.target.value)} style={numInput} />
              </Row>
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
                      onChange={e => setP("height_cm", e.target.value)} style={numInput} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" min="4" max="8" value={ftIn.ft}
                        onChange={e => handleFtIn("ft", e.target.value)} placeholder="ft" style={{ ...numInput, width: 52 }} />
                      <input type="number" min="0" max="11" value={ftIn.in}
                        onChange={e => handleFtIn("in", e.target.value)} placeholder="in" style={{ ...numInput, width: 52 }} />
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
                      onChange={e => setP("weight_kg", e.target.value)} style={numInput} />
                  ) : (
                    <input type="number" min="66" max="660" value={lbsVal}
                      onChange={e => handleLbs(e.target.value)} style={numInput} />
                  )}
                  <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{weightUnit}</span>
                </div>
              </div>
            </div>
            <button onClick={() => canNext1 && setStep(2)} style={{ ...primaryBtn, marginTop: 24, opacity: canNext1 ? 1 : 0.4 }}>
              Next →
            </button>
          </>
        )}

        {/* Step 2: Your goal */}
        {step === 2 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>Your goal</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
              Pick your primary focus and experience level.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Primary goal</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {GOALS.map(g => (
                    <button key={g.value} type="button" onClick={() => setP("fitness_goal", g.value)}
                      style={{ ...chipBtn, justifyContent: "flex-start", padding: "10px 14px", background: profile.fitness_goal === g.value ? "#fff5ee" : "#f7f7fb", color: profile.fitness_goal === g.value ? "#ff8c42" : "#555", border: profile.fitness_goal === g.value ? "1.5px solid #ff8c42" : "1.5px solid transparent", fontWeight: profile.fitness_goal === g.value ? 700 : 400 }}>
                      {g.label}
                    </button>
                  ))}
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
              <button onClick={() => { applysuggested(); setStep(3); }} style={{ ...primaryBtn, flex: 2 }}>Next →</button>
            </div>
          </>
        )}

        {/* Step 3: Macro targets */}
        {step === 3 && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 700 }}>Macro targets</h2>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#888" }}>
              {suggested ? "We've calculated a starting point — adjust freely." : "Set your daily targets."}
            </p>
            {suggested && (
              <button onClick={applysuggested} style={{ fontSize: 12, color: "#ff8c42", background: "none", border: "none", cursor: "pointer", padding: "0 0 12px", fontWeight: 600 }}>
                ↺ Reset to suggested
              </button>
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
                          placeholder="min" style={{ ...numInput, width: 62 }} />
                        <span style={{ fontSize: 12, color: "#aaa" }}>–</span>
                        <input type="number" min="0" value={macros[f.key] ?? ""}
                          onChange={e => setM(f.key, e.target.value)}
                          placeholder="max" style={{ ...numInput, width: 62 }} />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 3 }}>
                          {["above", "below"].map(d => {
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
                          onChange={e => setM(f.key, e.target.value)} style={{ ...numInput, width: 80 }} />
                      </>
                    )}
                    <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ ...secondaryBtn, flex: 1 }}>← Back</button>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, flex: 2, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Get Started"}
              </button>
            </div>
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
const numInput = { padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", textAlign: "right", background: "#fafafa", width: 80 };
const primaryBtn = { background: "#ff8c42", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%" };
const secondaryBtn = { background: "#f7f7fb", color: "#555", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const chipBtn = { border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500 };
