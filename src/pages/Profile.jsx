import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function cmToFtIn(cm) {
  const totalIn = Number(cm) / 2.54;
  return { ft: Math.floor(totalIn / 12), in: Math.round(totalIn % 12) };
}
function ftInToCm(ft, inch) {
  return Math.round((Number(ft || 0) * 12 + Number(inch || 0)) * 2.54);
}
function kgToLbs(kg) { return Math.round(Number(kg) * 2.20462); }
function lbsToKg(lbs) { return Math.round(Number(lbs) / 2.20462 * 10) / 10; }

const MACRO_FIELDS = [
  { key: "calories", minKey: "calories_min", dirKey: "calories_dir", label: "Calories", unit: "kcal", color: "#ff8c42", defaultDir: "below" },
  { key: "protein",  minKey: "protein_min",  dirKey: "protein_dir",  label: "Protein",  unit: "g",    color: "#4f8ef7", defaultDir: "above" },
  { key: "carbs",    minKey: "carbs_min",    dirKey: "carbs_dir",    label: "Carbs",    unit: "g",    color: "#f7c948", defaultDir: "below" },
  { key: "fat",      minKey: "fat_min",      dirKey: "fat_dir",      label: "Fat",      unit: "g",    color: "#e05c5c", defaultDir: "below" },
  { key: "fiber",    minKey: "fiber_min",    dirKey: "fiber_dir",    label: "Fiber",    unit: "g",    color: "#5cb85c", defaultDir: "above" },
  { key: "sugar",    minKey: "sugar_min",    dirKey: "sugar_dir",    label: "Sugar",    unit: "g",    color: "#c87dd4", defaultDir: "below" },
];

const GOALS_OPTIONS = [
  { value: "lose_weight",  label: "Lose weight"  },
  { value: "lose_fat",     label: "Lose fat"      },
  { value: "maintain",     label: "Maintain"      },
  { value: "gain_muscle",  label: "Gain muscle"   },
  { value: "gain_weight",  label: "Gain weight"   },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner",     label: "Beginner"      },
  { value: "intermediate", label: "Intermediate"  },
  { value: "advanced",     label: "Advanced"      },
];

const DEFAULT_GOALS = {
  calories: 2000, protein: 150, fat: 65, carbs: 250, fiber: 25, sugar: 50,
  calories_min: null, protein_min: null, carbs_min: null,
  fat_min: null, fiber_min: null, sugar_min: null,
  calories_dir: "below", protein_dir: "above", carbs_dir: "below",
  fat_dir: "below", fiber_dir: "above", sugar_dir: "below",
  gender: "male", age: "", height_cm: "", weight_kg: "",
  experience_level: "beginner", fitness_goal: "maintain",
};

export default function Profile() {
  const { user } = useAuth();
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [rangeEnabled, setRangeEnabled] = useState({});
  const [heightUnit, setHeightUnit] = useState("cm");
  const [ftIn, setFtIn] = useState({ ft: "", in: "" });
  const [weightUnit, setWeightUnit] = useState("kg");
  const [lbsVal, setLbsVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email || "";
  const initial = displayName[0]?.toUpperCase() || "?";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("nutrition_goals")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setGoals({ ...DEFAULT_GOALS, ...data });
          const enabled = {};
          MACRO_FIELDS.forEach(f => {
            if (data[f.minKey] != null) enabled[f.key] = true;
          });
          setRangeEnabled(enabled);
          if (data.height_cm) { const c = cmToFtIn(data.height_cm); setFtIn({ ft: String(c.ft), in: String(c.in) }); }
          if (data.weight_kg) setLbsVal(String(kgToLbs(data.weight_kg)));
        }
        setLoading(false);
      });
  }, [user]);

  function setG(key, val) {
    setGoals(g => ({ ...g, [key]: val === "" ? null : (isNaN(Number(val)) ? val : Number(val)) }));
  }

  function setGStr(key, val) {
    setGoals(g => ({ ...g, [key]: val }));
  }

  function toggleHeightUnit(unit) {
    if (unit === "ftin" && heightUnit === "cm") {
      if (goals.height_cm) { const c = cmToFtIn(goals.height_cm); setFtIn({ ft: String(c.ft), in: String(c.in) }); }
    } else if (unit === "cm" && heightUnit === "ftin") {
      const cm = ftInToCm(ftIn.ft, ftIn.in); if (cm) setGStr("height_cm", cm);
    }
    setHeightUnit(unit);
  }
  function handleFtIn(field, val) {
    const next = { ...ftIn, [field]: val };
    setFtIn(next);
    setGStr("height_cm", ftInToCm(next.ft, next.in));
  }
  function toggleWeightUnit(unit) {
    if (unit === "lbs" && weightUnit === "kg") {
      if (goals.weight_kg) setLbsVal(String(kgToLbs(goals.weight_kg)));
    } else if (unit === "kg" && weightUnit === "lbs") {
      const kg = lbsToKg(lbsVal); if (kg) setGStr("weight_kg", kg);
    }
    setWeightUnit(unit);
  }
  function handleLbs(val) {
    setLbsVal(val);
    setGStr("weight_kg", lbsToKg(val));
  }

  function toggleRange(key, minKey) {
    const next = !rangeEnabled[key];
    setRangeEnabled(r => ({ ...r, [key]: next }));
    if (!next) setGoals(g => ({ ...g, [minKey]: null }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("nutrition_goals")
      .upsert({ user_id: user.id, ...goals }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", color: "#888" }}>
        Sign in to view your profile.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px 40px" }}>
      <p className="font-bold text-[2rem] mb-1">Profile</p>

      {/* User card */}
      <div style={{
        background: "#fff", borderRadius: 12,
        padding: "24px 20px", marginBottom: 24,
        boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#ff8c42", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, flexShrink: 0,
          }}>
            {initial}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          {displayName && displayName !== user.email && (
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 16, color: "#333" }}>
              {displayName}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 14, color: "#888", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.email}
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#555', flexShrink: 0 }}
        >
          Sign Out
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#bbb", fontSize: 14, textAlign: "center" }}>Loading…</p>
      ) : (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* About you */}
          <Section title="About You">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FieldRow label="Gender">
                <div style={{ display: "flex", gap: 8 }}>
                  {["male", "female", "other"].map(g => (
                    <button key={g} type="button" onClick={() => setGStr("gender", g)}
                      style={{ ...chipBtn, background: goals.gender === g ? "#ff8c42" : "#f7f7fb", color: goals.gender === g ? "#fff" : "#555" }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </FieldRow>
              <FieldRow label="Age" unit="yrs">
                <input type="number" min="10" max="100" value={goals.age ?? ""}
                  onChange={e => setG("age", e.target.value)} style={numInput} />
              </FieldRow>
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
                  <input type="number" min="100" max="250" step="0.1" value={goals.height_cm ?? ""}
                    onChange={e => setGStr("height_cm", Number(e.target.value))} style={numInput} />
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
                  <input type="number" min="30" max="300" step="0.1" value={goals.weight_kg ?? ""}
                    onChange={e => setGStr("weight_kg", Number(e.target.value))} style={numInput} />
                ) : (
                  <input type="number" min="66" max="660" value={lbsVal}
                    onChange={e => handleLbs(e.target.value)} style={numInput} />
                )}
                <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{weightUnit}</span>
              </div>
            </div>
          </Section>

          {/* Fitness goal */}
          <Section title="Fitness Goal">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <span style={labelStyle}>Primary goal</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {GOALS_OPTIONS.map(g => (
                    <button key={g.value} type="button" onClick={() => setGStr("fitness_goal", g.value)}
                      style={{
                        ...chipBtn, justifyContent: "flex-start", padding: "10px 14px",
                        background: goals.fitness_goal === g.value ? "#fff5ee" : "#f7f7fb",
                        color: goals.fitness_goal === g.value ? "#ff8c42" : "#555",
                        border: goals.fitness_goal === g.value ? "1.5px solid #ff8c42" : "1.5px solid transparent",
                        fontWeight: goals.fitness_goal === g.value ? 700 : 400,
                      }}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span style={labelStyle}>Experience level</span>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {EXPERIENCE_OPTIONS.map(e => (
                    <button key={e.value} type="button" onClick={() => setGStr("experience_level", e.value)}
                      style={{ ...chipBtn, flex: 1, background: goals.experience_level === e.value ? "#ff8c42" : "#f7f7fb", color: goals.experience_level === e.value ? "#fff" : "#555" }}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Macro targets */}
          <Section title="Daily Nutrition Goals" subtitle="Toggle '+ range' to set a min–max window instead of a single target.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {MACRO_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>{f.label}</span>
                    <button type="button" onClick={() => toggleRange(f.key, f.minKey)}
                      style={{ fontSize: 11, color: rangeEnabled[f.key] ? "#ff8c42" : "#aaa", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                      {rangeEnabled[f.key] ? "range ✓" : "+ range"}
                    </button>
                    {rangeEnabled[f.key] ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" min="0" value={goals[f.minKey] ?? ""}
                          onChange={e => setG(f.minKey, e.target.value)}
                          placeholder="min" style={{ ...numInput, width: 66 }} />
                        <span style={{ fontSize: 12, color: "#aaa" }}>–</span>
                        <input type="number" min="0" value={goals[f.key] ?? ""}
                          onChange={e => setG(f.key, e.target.value)}
                          placeholder="max" style={{ ...numInput, width: 66 }} />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 3 }}>
                          {["above", "below"].map(d => {
                            const active = (goals[f.dirKey] ?? f.defaultDir) === d;
                            return (
                              <button key={d} type="button" onClick={() => setGStr(f.dirKey, d)}
                                style={{ ...unitToggle, background: active ? "#555" : "#f0f0f0", color: active ? "#fff" : "#aaa" }}>
                                {d === "above" ? "≥" : "≤"}
                              </button>
                            );
                          })}
                        </div>
                        <input type="number" min="0" value={goals[f.key] ?? ""}
                          onChange={e => setG(f.key, e.target.value)} style={{ ...numInput, width: 80 }} />
                      </>
                    )}
                    <span style={{ fontSize: 13, color: "#aaa", width: 28 }}>{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%", padding: "11px 0",
              background: saved ? "#5cb85c" : "#ff8c42",
              color: "#fff", border: "none", borderRadius: 10,
              fontWeight: 700, fontSize: 14,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
              transition: "background 0.2s",
            }}
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save Profile & Goals"}
          </button>
        </form>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      padding: "20px 20px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
    }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>{title}</h3>
      {subtitle && <p style={{ margin: "0 0 14px", fontSize: 12, color: "#888" }}>{subtitle}</p>}
      {!subtitle && <div style={{ marginBottom: 14 }} />}
      {children}
    </div>
  );
}

function FieldRow({ label, unit, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</span>
      {children}
      {unit && <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{unit}</span>}
    </div>
  );
}

const unitToggle = { border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 600 };
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#555" };
const numInput = { padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 16, outline: "none", textAlign: "right", background: "#fafafa", width: 80 };
const chipBtn = { border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center" };
