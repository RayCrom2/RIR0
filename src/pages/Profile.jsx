import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { PwaSheet } from "../App";
import { triggerPwaInstall, isPwaStandalone, isPwaIOS, hasPwaPrompt } from "../lib/pwaInstall";
import {
  ACTIVITY_LEVELS,
  DEFICIT_SEVERITY,
  SURPLUS_SEVERITY,
  GOAL_GROUPS,
  applyGoalToggle,
  calcSuggested,
  getAge,
  BirthDateInput,
} from "../components/OnboardingModal";

function cmToFtIn(cm) {
  const totalIn = Number(cm) / 2.54;
  return { ft: Math.floor(totalIn / 12), in: Math.round(totalIn % 12) };
}
function ftInToCm(ft, inch) {
  return Math.round((Number(ft || 0) * 12 + Number(inch || 0)) * 2.54);
}
function kgToLbs(kg) {
  return Math.round(Number(kg) * 2.20462 * 10) / 10;
}
function lbsToKg(lbs) {
  return Number((Number(lbs) / 2.20462).toFixed(5));
}
function dispWeight(kg, unit, places = 1) {
  if (!kg) return "—";
  const val = unit === "lbs" ? Number(kg) * 2.20462 : Number(kg);
  return val.toFixed(places);
}

const MACRO_FIELDS = [
  {
    key: "calories",
    minKey: "calories_min",
    dirKey: "calories_dir",
    label: "Calories",
    unit: "kcal",
    color: "#ff8c42",
    defaultDir: "below",
  },
  {
    key: "protein",
    minKey: "protein_min",
    dirKey: "protein_dir",
    label: "Protein",
    unit: "g",
    color: "#4f8ef7",
    defaultDir: "above",
  },
  {
    key: "carbs",
    minKey: "carbs_min",
    dirKey: "carbs_dir",
    label: "Carbs",
    unit: "g",
    color: "#f7c948",
    defaultDir: "below",
  },
  {
    key: "fat",
    minKey: "fat_min",
    dirKey: "fat_dir",
    label: "Fat",
    unit: "g",
    color: "#e05c5c",
    defaultDir: "below",
  },
  {
    key: "fiber",
    minKey: "fiber_min",
    dirKey: "fiber_dir",
    label: "Fiber",
    unit: "g",
    color: "#5cb85c",
    defaultDir: "above",
  },
  {
    key: "sugar",
    minKey: "sugar_min",
    dirKey: "sugar_dir",
    label: "Sugar",
    unit: "g",
    color: "#c87dd4",
    defaultDir: "below",
  },
];

const MACRO_VALUE_KEYS = new Set(
  MACRO_FIELDS.flatMap((f) => [f.key, f.minKey]),
);

function detectSeverity(data, severities) {
  const CMP_KEYS = ["calories", "protein", "carbs", "fat", "fiber"];
  for (const s of severities) {
    const calc = calcSuggested({ ...data, deficitSeverity: s.value, surplusSeverity: s.value });
    if (!calc) return "custom";
    if (CMP_KEYS.every((k) => Number(data[k]) === calc[k])) return s.value;
  }
  return "custom";
}

const GOALS_OPTIONS = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "maintain", label: "Maintain" },
  { value: "gain_muscle", label: "Gain muscle" },
  { value: "gain_weight", label: "Gain weight" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const WEIGH_FREQ_OPTIONS = [
  { value: "daily", label: "Daily", days: 1 },
  { value: "3x_week", label: "Every 3d", days: 3 },
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "biweekly", label: "Biweekly", days: 14 },
];

const DEFAULT_GOALS = {
  calories: 2000,
  protein: 150,
  fat: 65,
  carbs: 250,
  fiber: 25,
  sugar: 50,
  calories_min: null,
  protein_min: null,
  carbs_min: null,
  fat_min: null,
  fiber_min: null,
  sugar_min: null,
  calories_dir: "below",
  protein_dir: "above",
  carbs_dir: "below",
  fat_dir: "below",
  fiber_dir: "above",
  sugar_dir: "below",
  gender: "male",
  age: "",
  birth_date: "",
  height_cm: "",
  weight_kg: "",
  starting_weight_kg: "",
  target_weight_kg: "",
  preferred_weight_unit: "kg",
  preferred_height_unit: "cm",
  experience_level: "beginner",
  fitness_goal: "maintain",
  fitness_goals: ["maintain"],
  activity_level: "moderate",
  weigh_in_frequency: "weekly",
  weight_decimal_places: 1,
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
  const savedSnapshot = useRef(null);
  const [loading, setLoading] = useState(true);
  const [weighInOpen, setWeighInOpen] = useState(false);
  const [weighInValue, setWeighInValue] = useState("");
  const [isReWeigh, setIsReWeigh] = useState(false);
  const [goalWeightEditing, setGoalWeightEditing] = useState(false);
  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [unitPrefsOpen, setUnitPrefsOpen] = useState(false);
  const [pwaSheetOpen, setPwaSheetOpen] = useState(false);
  const showPwaCard = !isPwaStandalone() && window.matchMedia("(max-width: 767px)").matches;
  const [deficitSeverity, setDeficitSeverity] = useState("moderate");
  const [surplusSeverity, setSurplusSeverity] = useState("moderate");
  const [weightLogs, setWeightLogs] = useState([]);

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
          const merged = { ...DEFAULT_GOALS, ...data };
          // Backwards compat: derive fitness_goals from fitness_goal if not set
          if (!data.fitness_goals?.length) {
            merged.fitness_goals = data.fitness_goal
              ? [data.fitness_goal]
              : ["maintain"];
          }
          setGoals(merged);
          const fg = merged.fitness_goals ?? ["maintain"];
          if (fg.some((g) => ["lose_weight", "lose_fat"].includes(g))) {
            setDeficitSeverity(detectSeverity(merged, DEFICIT_SEVERITY));
          } else if (fg.some((g) => ["gain_muscle", "gain_weight"].includes(g))) {
            setSurplusSeverity(detectSeverity(merged, SURPLUS_SEVERITY));
          }
          const enabled = {};
          MACRO_FIELDS.forEach((f) => {
            if (data[f.minKey] != null) enabled[f.key] = true;
          });
          const wUnit = data.preferred_weight_unit || "kg";
          const hUnit = data.preferred_height_unit || "cm";
          setHeightUnit(hUnit);
          setWeightUnit(wUnit);
          if (data.height_cm) {
            const c = cmToFtIn(data.height_cm);
            setFtIn({ ft: String(c.ft), in: String(c.in) });
          }
          if (data.weight_kg) setLbsVal(String(kgToLbs(data.weight_kg)));
          savedSnapshot.current = { goals: merged, weightUnit: wUnit, heightUnit: hUnit };
        }
        setLoading(false);
      });
    supabase
      .from("weight_logs")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .order("date")
      .then(({ data }) => {
        if (data) setWeightLogs(data);
      });
  }, [user]);

  function setG(key, val) {
    setGoals((g) => ({
      ...g,
      [key]: val === "" ? null : isNaN(Number(val)) ? val : Number(val),
    }));
    if (MACRO_VALUE_KEYS.has(key)) {
      const fg = goals.fitness_goals ?? ["maintain"];
      if (fg.some((g) => ["lose_weight", "lose_fat"].includes(g)))
        setDeficitSeverity("custom");
      else if (fg.some((g) => ["gain_muscle", "gain_weight"].includes(g)))
        setSurplusSeverity("custom");
    }
  }
  function setGStr(key, val) {
    setGoals((g) => ({ ...g, [key]: val }));
  }

  function toggleHeightUnit(unit) {
    if (unit === "ftin" && heightUnit === "cm") {
      if (goals.height_cm) {
        const c = cmToFtIn(goals.height_cm);
        setFtIn({ ft: String(c.ft), in: String(c.in) });
      }
    } else if (unit === "cm" && heightUnit === "ftin") {
      const cm = ftInToCm(ftIn.ft, ftIn.in);
      if (cm) setGStr("height_cm", cm);
    }
    setHeightUnit(unit);
    setGStr("preferred_height_unit", unit);
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
      const kg = lbsToKg(lbsVal);
      if (kg) setGStr("weight_kg", kg);
    }
    setWeightUnit(unit);
    setGStr("preferred_weight_unit", unit);
  }
  function handleLbs(val) {
    setLbsVal(val);
    setGStr("weight_kg", lbsToKg(val));
  }

  function toggleRange(key, minKey) {
    const next = !rangeEnabled[key];
    setRangeEnabled((r) => ({ ...r, [key]: next }));
    if (!next) setGoals((g) => ({ ...g, [minKey]: null }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    let nextWeighInDate = goals.next_weigh_in_date ?? null;
    if (goals.weigh_in_frequency !== savedSnapshot.current.goals.weigh_in_frequency) {
      const freqDays = WEIGH_FREQ_OPTIONS.find(f => f.value === goals.weigh_in_frequency)?.days ?? 7;
      if (latestWeighInDate) {
        const d = new Date(latestWeighInDate + "T00:00:00");
        d.setDate(d.getDate() + freqDays);
        nextWeighInDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      } else {
        nextWeighInDate = null;
      }
    }
    await supabase.from("nutrition_goals").upsert(
      {
        user_id: user.id,
        ...goals,
        next_weigh_in_date: nextWeighInDate,
        age: computedAge || goals.age,
        fitness_goal: goals.fitness_goals?.[0] ?? "maintain",
        preferred_weight_unit: weightUnit,
        preferred_height_unit: heightUnit,
      },
      { onConflict: "user_id" },
    );
    setGoals(g => ({ ...g, next_weigh_in_date: nextWeighInDate }));
    setSaving(false);
    setSaved(true);
    savedSnapshot.current = { goals: { ...goals, next_weigh_in_date: nextWeighInDate }, weightUnit, heightUnit };
    setTimeout(() => setSaved(false), 2000);
  }

  function openWeighIn() {
    setIsReWeigh(false);
    setWeighInValue("");
    setWeighInOpen(true);
  }

  function openReWeigh() {
    setIsReWeigh(true);
    if (weightLogs.length > 0) {
      const latest = weightLogs[weightLogs.length - 1];
      setWeighInValue(dispWeight(latest.weight_kg, weightUnit, goals.weight_decimal_places || 1));
    } else {
      setWeighInValue("");
    }
    setWeighInOpen(true);
  }

  async function handleWeighIn(e) {
    e.preventDefault();
    const kg =
      weightUnit === "lbs" ? lbsToKg(weighInValue) : Number(weighInValue);
    if (!kg) return;
    let dateStr;
    if (isReWeigh && weightLogs.length > 0) {
      dateStr = weightLogs[weightLogs.length - 1].date;
    } else {
      const d = new Date();
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const ops = [
      supabase
        .from("weight_logs")
        .upsert(
          { user_id: user.id, date: dateStr, weight_kg: kg },
          { onConflict: "user_id,date" },
        ),
    ];
    if (!isReWeigh) {
      const freqDays = WEIGH_FREQ_OPTIONS.find(f => f.value === (goals.weigh_in_frequency || "weekly"))?.days ?? 7;
      const d = new Date(dateStr + "T00:00:00");
      d.setDate(d.getDate() + freqDays);
      const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      ops.push(
        supabase.from("nutrition_goals").upsert(
          { user_id: user.id, next_weigh_in_date: nextDate },
          { onConflict: "user_id" },
        )
      );
      setGoals(g => ({ ...g, next_weigh_in_date: nextDate }));
    }
    await Promise.all(ops);
    setGStr("weight_kg", kg);
    setLbsVal(String(kgToLbs(kg)));
    setWeightLogs((prev) => {
      const without = prev.filter((l) => l.date !== dateStr);
      return [...without, { date: dateStr, weight_kg: kg }].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    });
    setWeighInOpen(false);
    setWeighInValue("");
    setIsReWeigh(false);
  }

  if (!user) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "60px auto",
          textAlign: "center",
          color: "#888",
        }}
      >
        Sign in to view your profile.
      </div>
    );
  }

  const fitnessGoals = goals.fitness_goals ?? ["maintain"];
  const isLoss = fitnessGoals.some((g) =>
    ["lose_weight", "lose_fat"].includes(g),
  );
  const isGain = fitnessGoals.some((g) =>
    ["gain_muscle", "gain_weight"].includes(g),
  );

  const hasChanges = !savedSnapshot.current ||
    JSON.stringify(goals) !== JSON.stringify(savedSnapshot.current.goals) ||
    weightUnit !== savedSnapshot.current.weightUnit ||
    heightUnit !== savedSnapshot.current.heightUnit;

  const _d = new Date();
  const todayDateStr = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
  const latestWeightKg =
    weightLogs.length > 0
      ? weightLogs[weightLogs.length - 1].weight_kg
      : goals.weight_kg || null;
  const latestWeighInDate =
    weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].date : null;
  const shouldShowWeighIn = !goals.next_weigh_in_date || todayDateStr >= goals.next_weigh_in_date;

  // Compute TDEE for display in suggestion card
  const computedAge = getAge(goals.birth_date) ?? Number(goals.age);
  const hasProfileData = goals.weight_kg && goals.height_cm && computedAge;
  let tdeeDisplay = null;
  if (hasProfileData) {
    const w = Number(goals.weight_kg),
      h = Number(goals.height_cm),
      a = computedAge;
    const bmr =
      goals.gender === "male"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
    const actMult =
      ACTIVITY_LEVELS.find((l) => l.value === goals.activity_level)
        ?.multiplier ?? 1.55;
    tdeeDisplay = Math.round(bmr * actMult);
  }

  return (
    <div className="profile-page">
      <p className="font-bold text-[2rem] mb-1">Profile</p>

      {loading ? (
        <p style={{ color: "#bbb", fontSize: 14, textAlign: "center" }}>
          Loading…
        </p>
      ) : (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column" }}>
          <div className="profile-cols">
            {/* ── Column 1: About You + Weight Progress ── */}
            <div className="profile-col">
          {/* ── About You ── */}
          <Section title="About You">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Identity header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 10, borderBottom: "1px solid #f0f0f0" }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#ff8c42", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flexShrink: 0 }}>
                    {initial}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  {displayName && displayName !== user.email && (
                    <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 15, color: "#333" }}>{displayName}</p>
                  )}
                  <p style={{ margin: 0, fontSize: 13, color: "#888", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>Age</span>
                {goals.birth_date ? (
                  <span style={{ fontSize: 14, color: "#555" }}>{getAge(goals.birth_date)}</span>
                ) : (
                  <BirthDateInput
                    value={goals.birth_date ?? ""}
                    onChange={(v) => setGStr("birth_date", v)}
                    style={{ ...numInput, width: "auto", textAlign: "left" }}
                  />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#333",
                  }}
                >
                  Height
                </span>
                {goals.height_cm ? (
                  <span style={{ fontSize: 14, color: "#555" }}>
                    {heightUnit === "cm"
                      ? `${goals.height_cm} cm`
                      : (() => { const c = cmToFtIn(goals.height_cm); return `${c.ft}′${c.in}″`; })()}
                  </span>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["cm", "ftin"].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => toggleHeightUnit(u)}
                          style={{
                            ...unitToggle,
                            background:
                              heightUnit === u ? "#ff8c42" : "#f0f0f0",
                            color: heightUnit === u ? "#fff" : "#888",
                          }}
                        >
                          {u === "ftin" ? "ft/in" : "cm"}
                        </button>
                      ))}
                    </div>
                    {heightUnit === "cm" ? (
                      <input
                        type="number"
                        min="100"
                        max="250"
                        step="0.1"
                        value={goals.height_cm ?? ""}
                        onChange={(e) =>
                          setGStr("height_cm", Number(e.target.value))
                        }
                        onFocus={(e) => e.target.select()}
                        style={numInput}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <input
                          type="number"
                          min="4"
                          max="8"
                          value={ftIn.ft}
                          onChange={(e) => handleFtIn("ft", e.target.value)}
                          placeholder="ft"
                          onFocus={(e) => e.target.select()}
                          style={{ ...numInput, width: 52 }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="11"
                          value={ftIn.in}
                          onChange={(e) => handleFtIn("in", e.target.value)}
                          placeholder="in"
                          onFocus={(e) => e.target.select()}
                          style={{ ...numInput, width: 62 }}
                        />
                      </div>
                    )}
                    {heightUnit === "cm" && (
                      <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>
                        cm
                      </span>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#333",
                  }}
                >
                  Weight
                </span>
                {shouldShowWeighIn && (
                  <button
                    type="button"
                    onClick={openWeighIn}
                    style={{
                      fontSize: 12,
                      color: "#ff8c42",
                      background: "#fff5ee",
                      border: "1px solid #ff8c42",
                      borderRadius: 7,
                      padding: "5px 10px",
                      cursor: "pointer",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Weigh in
                  </button>
                )}
                {latestWeightKg ? (
                  <button
                    type="button"
                    onClick={openReWeigh}
                    title="Edit most recent weigh-in"
                    className="weight-value-btn"
                    style={{
                      fontSize: 14,
                      color: "#555",
                      textAlign: "right",
                      background: "none",
                      border: "1px solid transparent",
                      borderRadius: 6,
                      cursor: "pointer",
                      padding: "2px 5px",
                      fontFamily: "inherit",
                      marginRight: 2,
                    }}
                  >
                    {dispWeight(latestWeightKg, weightUnit, goals.weight_decimal_places || 1)}
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: 14,
                      color: "#ccc",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    —
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>
                  {weightUnit}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 2,
                }}
              >
                <span style={{ fontSize: 12, color: "#aaa", flex: 1 }}>
                  Weigh-in Frequency
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {WEIGH_FREQ_OPTIONS.map((opt) => {
                    const active =
                      (goals.weigh_in_frequency || "weekly") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGStr("weigh_in_frequency", opt.value)}
                        style={{
                          ...unitToggle,
                          fontSize: 11,
                          background: active ? "#ff8c42" : "#f0f0f0",
                          color: active ? "#fff" : "#888",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                <span style={{ fontSize: 12, color: "#aaa", flex: 1 }}>Unit Preferences</span>
                <button
                  type="button"
                  onClick={() => setUnitPrefsOpen((o) => !o)}
                  style={{ fontSize: 12, color: "#ff8c42", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 2px" }}
                >
                  {unitPrefsOpen ? "Hide" : "Edit"}
                </button>
              </div>
              {unitPrefsOpen && (
                <div style={{ background: "#f7f7fb", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#555", flex: 1 }}>Height unit</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["cm", "ftin"].map((u) => (
                        <button key={u} type="button" onClick={() => toggleHeightUnit(u)}
                          style={{ ...unitToggle, background: heightUnit === u ? "#ff8c42" : "#e8e8e8", color: heightUnit === u ? "#fff" : "#888" }}>
                          {u === "ftin" ? "ft/in" : "cm"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#555", flex: 1 }}>Weight unit</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["kg", "lbs"].map((u) => (
                        <button key={u} type="button" onClick={() => toggleWeightUnit(u)}
                          style={{ ...unitToggle, background: weightUnit === u ? "#ff8c42" : "#e8e8e8", color: weightUnit === u ? "#fff" : "#888" }}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#555", flex: 1 }}>Weight decimal places</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1, 2].map((n) => {
                        const active = (goals.weight_decimal_places || 1) === n;
                        return (
                          <button key={n} type="button" onClick={() => setG("weight_decimal_places", n)}
                            style={{ ...unitToggle, background: active ? "#ff8c42" : "#e8e8e8", color: active ? "#fff" : "#888" }}>
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {(isLoss || isGain) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>
                    Goal weight
                  </span>
                  {goalWeightEditing ? (
                    <>
                      {weightUnit === "kg" ? (
                        <input
                          type="number"
                          min="30"
                          max="300"
                          step="0.1"
                          value={goals.target_weight_kg ?? ""}
                          onChange={(e) => setGStr("target_weight_kg", e.target.value === "" ? "" : Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          autoFocus
                          style={{ ...numInput, padding: "7px 6px" }}
                        />
                      ) : (
                        <input
                          type="number"
                          min="66"
                          max="660"
                          value={goals.target_weight_kg ? Math.round(Number(goals.target_weight_kg) * 2.20462) : ""}
                          onChange={(e) => setGStr("target_weight_kg", e.target.value === "" ? "" : lbsToKg(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          autoFocus
                          style={{ ...numInput, padding: "7px 6px" }}
                        />
                      )}
                      <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{weightUnit}</span>
                      <button type="button" onClick={() => setGoalWeightEditing(false)}
                        style={{ fontSize: 12, color: "#ff8c42", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 2px" }}>
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 14, color: goals.target_weight_kg ? "#555" : "#ccc" }}>
                        {goals.target_weight_kg
                          ? `${dispWeight(Number(goals.target_weight_kg), weightUnit, goals.weight_decimal_places || 1)} ${weightUnit}`
                          : "—"}
                      </span>
                      <button type="button" onClick={() => setGoalWeightEditing(true)}
                        style={{ fontSize: 12, color: "#ff8c42", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 2px" }}>
                        Edit
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* ── Weight Progress ── */}
          {weightLogs.length > 0 && (
            <Section
              title="Weight Progress"
              action={
                <button
                  type="button"
                  onClick={() => setGraphModalOpen(true)}
                  title="Expand graph"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}
                >
                  ⤢
                </button>
              }
            >
              <WeightGraph
                logs={weightLogs}
                startKg={Number(goals.starting_weight_kg) || null}
                targetKg={Number(goals.target_weight_kg) || null}
                unit={weightUnit}
                isLoss={isLoss}
                isGain={isGain}
                decimalPlaces={goals.weight_decimal_places || 1}
              />
            </Section>
          )}
            </div>

            {/* ── Column 2: Fitness Profile ── */}
            <div className="profile-col">
          {/* ── Fitness Profile ── */}
          <Section title="Fitness Profile">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Multi-select goals */}
              <div>
                <span style={labelStyle}>Goals</span>
                <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#aaa" }}>
                  Select all that apply. Compatible goals can be combined.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {GOALS_OPTIONS.map((g) => {
                    const selected = fitnessGoals.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() =>
                          setGoals((prev) => ({
                            ...prev,
                            fitness_goals: applyGoalToggle(
                              prev.fitness_goals ?? ["maintain"],
                              g.value,
                            ),
                          }))
                        }
                        style={{
                          ...chipBtn,
                          justifyContent: "flex-start",
                          padding: "10px 14px",
                          background: selected ? "#fff5ee" : "#f7f7fb",
                          color: selected ? "#ff8c42" : "#555",
                          border: selected
                            ? "1.5px solid #ff8c42"
                            : "1.5px solid transparent",
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        <span style={{ flex: 1 }}>{g.label}</span>
                        {selected && <span style={{ fontSize: 13 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Experience level */}
              <div>
                <span style={labelStyle}>Experience level</span>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {EXPERIENCE_OPTIONS.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => setGStr("experience_level", e.value)}
                      style={{
                        ...chipBtn,
                        flex: 1,
                        background:
                          goals.experience_level === e.value
                            ? "#ff8c42"
                            : "#f7f7fb",
                        color:
                          goals.experience_level === e.value ? "#fff" : "#555",
                      }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity level */}
              <div>
                <span style={labelStyle}>Activity level</span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    marginTop: 6,
                  }}
                >
                  {ACTIVITY_LEVELS.map((a) => {
                    const sel = goals.activity_level === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setGStr("activity_level", a.value)}
                        style={{
                          ...chipBtn,
                          justifyContent: "flex-start",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: "10px 14px",
                          gap: 1,
                          background: sel ? "#fff5ee" : "#f7f7fb",
                          color: sel ? "#ff8c42" : "#555",
                          border: sel
                            ? "1.5px solid #ff8c42"
                            : "1.5px solid transparent",
                          fontWeight: 400,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {a.label}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: sel ? "#ff8c42bb" : "#888",
                          }}
                        >
                          {a.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>
            </div>

            {/* ── Column 3: Daily Nutrition Goals ── */}
            <div className="profile-col">
          {/* ── Daily Nutrition Goals ── */}
          <Section
            title="Daily Nutrition Goals"
            subtitle="Toggle '+ range' to set a min–max window instead of a single target."
          >
            {/* Suggestion card — only shown when profile data is complete */}
            {hasProfileData && (
              <div
                style={{
                  background: "#fff8f2",
                  border: "1px solid #ffcba4",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 18,
                }}
              >
                <p
                  style={{
                    margin: "0 0 2px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#ff8c42",
                  }}
                >
                  Suggested targets
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#888" }}>
                  Estimated TDEE:{" "}
                  <strong>{tdeeDisplay?.toLocaleString()} kcal/day</strong>
                </p>

                {(isLoss || isGain) && (
                  <div style={{ marginBottom: 12 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#555",
                        margin: "0 0 6px",
                      }}
                    >
                      {isLoss ? "Deficit intensity" : "Surplus intensity"}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      {(isLoss ? DEFICIT_SEVERITY : SURPLUS_SEVERITY).map(
                        (s) => {
                          const active =
                            (isLoss ? deficitSeverity : surplusSeverity) ===
                            s.value;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() =>
                                isLoss
                                  ? setDeficitSeverity(s.value)
                                  : setSurplusSeverity(s.value)
                              }
                              style={{
                                ...chipBtn,
                                justifyContent: "flex-start",
                                padding: "8px 12px",
                                gap: 8,
                                background: active ? "#fff5ee" : "#f0ece8",
                                color: active ? "#ff8c42" : "#555",
                                border: active
                                  ? "1.5px solid #ff8c42"
                                  : "1.5px solid transparent",
                                fontWeight: 400,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  minWidth: 82,
                                  fontSize: 13,
                                }}
                              >
                                {s.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  color: active ? "#ff8c42bb" : "#888",
                                }}
                              >
                                {s.desc}
                              </span>
                            </button>
                          );
                        },
                      )}
                      {(() => {
                        const active =
                          (isLoss ? deficitSeverity : surplusSeverity) ===
                          "custom";
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              isLoss
                                ? setDeficitSeverity("custom")
                                : setSurplusSeverity("custom")
                            }
                            style={{
                              ...chipBtn,
                              justifyContent: "flex-start",
                              padding: "8px 12px",
                              gap: 8,
                              background: active ? "#fff5ee" : "#f0ece8",
                              color: active ? "#ff8c42" : "#555",
                              border: active
                                ? "1.5px solid #ff8c42"
                                : "1.5px solid transparent",
                              fontWeight: 400,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                minWidth: 82,
                                fontSize: 13,
                              }}
                            >
                              Custom
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: active ? "#ff8c42bb" : "#888",
                              }}
                            >
                              Manually set macro values
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {(() => {
                  const isCustom = (isLoss ? deficitSeverity : surplusSeverity) === "custom";
                  return (
                    <button
                      type="button"
                      disabled={isCustom}
                      onClick={() => {
                        const calc = calcSuggested({
                          ...goals,
                          age: computedAge,
                          deficitSeverity,
                          surplusSeverity,
                        });
                        if (calc) setGoals((g) => ({ ...g, ...calc }));
                      }}
                      style={{
                        width: "100%",
                        padding: "9px 0",
                        background: isCustom ? "#e0e0e0" : "#ff8c42",
                        color: isCustom ? "#aaa" : "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isCustom ? "default" : "pointer",
                      }}
                    >
                      Apply suggested targets
                    </button>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {MACRO_FIELDS.map((f) => (
                <div key={f.key}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: f.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      {f.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleRange(f.key, f.minKey)}
                      style={{
                        fontSize: 11,
                        color: rangeEnabled[f.key] ? "#ff8c42" : "#aaa",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                    >
                      {rangeEnabled[f.key] ? "range ✓" : "+ range"}
                    </button>
                    {rangeEnabled[f.key] ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={goals[f.minKey] ?? ""}
                          onChange={(e) => setG(f.minKey, e.target.value)}
                          placeholder="min"
                          onFocus={(e) => e.target.select()}
                          style={{ ...numInput, width: 66 }}
                        />
                        <span style={{ fontSize: 12, color: "#aaa" }}>–</span>
                        <input
                          type="number"
                          min="0"
                          value={goals[f.key] ?? ""}
                          onChange={(e) => setG(f.key, e.target.value)}
                          placeholder="max"
                          onFocus={(e) => e.target.select()}
                          style={{ ...numInput, width: 66 }}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 3 }}>
                          {["below", "above"].map((d) => {
                            const active =
                              (goals[f.dirKey] ?? f.defaultDir) === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setGStr(f.dirKey, d)}
                                style={{
                                  ...unitToggle,
                                  background: active ? "#555" : "#f0f0f0",
                                  color: active ? "#fff" : "#aaa",
                                }}
                              >
                                {d === "above" ? "≥" : "≤"}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={goals[f.key] ?? ""}
                          onChange={(e) => setG(f.key, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          style={{ ...numInput, width: 80 }}
                        />
                      </>
                    )}
                    <span style={{ fontSize: 13, color: "#aaa", width: 28 }}>
                      {f.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !hasChanges}
            style={{
              width: "100%",
              padding: "11px 0",
              background: saved ? "#5cb85c" : hasChanges ? "#ff8c42" : "#e0e0e0",
              color: saved || hasChanges ? "#fff" : "#aaa",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: saving || !hasChanges ? "default" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save Profile & Goals"}
          </button>
        </form>
      )}

      {graphModalOpen && (
        <div
          onClick={() => setGraphModalOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 760, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>Weight Progress</h3>
              <button
                type="button"
                onClick={() => setGraphModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}
              >
                ✕
              </button>
            </div>
            <WeightGraph
              logs={weightLogs}
              startKg={Number(goals.starting_weight_kg) || null}
              targetKg={Number(goals.target_weight_kg) || null}
              unit={weightUnit}
              isLoss={isLoss}
              isGain={isGain}
              decimalPlaces={goals.weight_decimal_places || 1}
            />
          </div>
        </div>
      )}

      {showPwaCard && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 14px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 14, marginTop: 24 }}>
          <img src="/pwa-192x192.png" alt="app icon" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14, color: "#333" }}>Add to Home Screen</p>
            <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Install for a full-screen experience</p>
          </div>
          <button
            type="button"
            onClick={() => setPwaSheetOpen(true)}
            style={{ flexShrink: 0, background: "#ff8c42", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Install
          </button>
        </div>
      )}

      {pwaSheetOpen && (
        <PwaSheet
          ios={isPwaIOS()}
          onInstall={async () => { await triggerPwaInstall(); setPwaSheetOpen(false); }}
          onDismiss={() => setPwaSheetOpen(false)}
        />
      )}

      {weighInOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setWeighInOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 600,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 360,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: "#333" }}>
                {isReWeigh ? "Edit Weigh-In" : "Weigh In"}
              </span>
              <button
                type="button"
                onClick={() => setWeighInOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#aaa",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            {isReWeigh && latestWeighInDate ? (
              <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 16px" }}>
                Editing entry from{" "}
                {new Date(latestWeighInDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "#777",
                  lineHeight: 1.65,
                  margin: "0 0 20px",
                  background: "#f7f7fb",
                  borderRadius: 9,
                  padding: "12px 14px",
                }}
              >
                For the most consistent results, weigh yourself in the morning
                after using the bathroom, wearing the same amount of clothing
                (or none), and before eating or drinking.
              </p>
            )}
            <form onSubmit={handleWeighIn}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max={weightUnit === "lbs" ? 660 : 300}
                  value={weighInValue}
                  onChange={(e) => setWeighInValue(e.target.value)}
                  placeholder={`Weight in ${weightUnit}`}
                  autoFocus
                  style={{
                    ...numInput,
                    flex: 1,
                    width: "auto",
                    textAlign: "left",
                  }}
                />
                <div style={{ display: "flex", gap: 4 }}>
                  {["kg", "lbs"].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => toggleWeightUnit(u)}
                      style={{
                        ...unitToggle,
                        background: weightUnit === u ? "#ff8c42" : "#f0f0f0",
                        color: weightUnit === u ? "#fff" : "#888",
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={!weighInValue}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  background: weighInValue ? "#ff8c42" : "#f0f0f0",
                  color: weighInValue ? "#fff" : "#bbb",
                  border: "none",
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: weighInValue ? "pointer" : "default",
                }}
              >
                {isReWeigh ? "Update Weight" : "Log Weight"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WeightGraph({ logs, startKg, targetKg, unit, isLoss, isGain, decimalPlaces = 1 }) {
  const [cursor, setCursor] = useState(null); // index into logs

  const toDisp = (kg) =>
    (unit === "lbs" ? kg * 2.20462 : kg).toFixed(decimalPlaces);
  const unitLabel = unit === "lbs" ? "lbs" : "kg";

  const allKg = logs.map((l) => l.weight_kg);
  if (startKg) allKg.push(startKg);
  if (targetKg) allKg.push(targetKg);
  const minKg = Math.min(...allKg);
  const maxKg = Math.max(...allKg);
  const kgRange = maxKg - minKg || 2;
  const padY = kgRange * 0.18;
  const yMin = minKg - padY;
  const yMax = maxKg + padY;

  const W = 400,
    H = 160;
  const pL = 42,
    pR = 38,
    pT = 14,
    pB = 26;
  const plotW = W - pL - pR;
  const plotH = H - pT - pB;

  const times = logs.map((l) => new Date(l.date).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tRange = tMax - tMin || 1;

  const xOf = (dateStr) =>
    pL + ((new Date(dateStr).getTime() - tMin) / tRange) * plotW;
  const yOf = (kg) => pT + plotH - ((kg - yMin) / (yMax - yMin)) * plotH;

  const pts = logs
    .map((l) => `${xOf(l.date).toFixed(1)},${yOf(l.weight_kg).toFixed(1)}`)
    .join(" ");

  // Progress annotation
  const latest = logs[logs.length - 1]?.weight_kg;
  let progressMsg = null,
    progressColor = "#aaa";
  if (startKg && latest != null) {
    const moved = startKg - latest;
    const onTrack = (isLoss && moved > 0) || (isGain && moved < 0);
    progressColor = onTrack ? "#5cb85c" : isLoss || isGain ? "#e05c5c" : "#aaa";
    if (isLoss) {
      progressMsg =
        moved > 0.05
          ? `▼ ${toDisp(moved)} ${unitLabel} lost`
          : moved < -0.05
            ? `▲ ${toDisp(Math.abs(moved))} ${unitLabel} gained`
            : "No change yet";
    } else if (isGain) {
      progressMsg =
        moved < -0.05
          ? `▲ ${toDisp(Math.abs(moved))} ${unitLabel} gained`
          : moved > 0.05
            ? `▼ ${toDisp(moved)} ${unitLabel} lost`
            : "No change yet";
    }
    if (targetKg && progressMsg && progressMsg !== "No change yet") {
      const rem = Math.abs(latest - targetKg);
      if (rem > 0.05) progressMsg += ` · ${toDisp(rem)} ${unitLabel} to go`;
      else progressMsg += " · Goal reached! 🎉";
    }
  }

  // Y-axis: nice round ticks in display unit
  const dispMin = unit === "lbs" ? yMin * 2.20462 : yMin;
  const dispMax = unit === "lbs" ? yMax * 2.20462 : yMax;
  const dispRange = dispMax - dispMin;
  const niceStep = (() => {
    for (const s of [1, 2, 2.5, 5, 10, 20, 25, 50, 100]) {
      if (dispRange / s <= 5) return s;
    }
    return 100;
  })();
  const firstTick = Math.ceil(dispMin / niceStep) * niceStep;
  const yTicks = [];
  for (let v = firstTick; v <= dispMax + 1e-9; v = Math.round((v + niceStep) * 1e6) / 1e6) {
    yTicks.push(v);
  }
  const kgOfDisp = (v) => unit === "lbs" ? v / 2.20462 : v;
  const fmtTick = (v) => Number.isInteger(v) ? String(v) : v.toFixed(1);

  const goalColor = isLoss ? "#5cb85c" : isGain ? "#4f8ef7" : "#888";

  return (
    <div>
      {progressMsg && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: progressColor,
            margin: "0 0 10px",
            textAlign: "center",
          }}
        >
          {progressMsg}
        </p>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", touchAction: "none" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * W;
          let nearest = 0, nearestDist = Infinity;
          logs.forEach((l, i) => {
            const d = Math.abs(xOf(l.date) - svgX);
            if (d < nearestDist) { nearestDist = d; nearest = i; }
          });
          setCursor(nearest);
        }}
        onMouseLeave={() => setCursor(null)}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX = ((touch.clientX - rect.left) / rect.width) * W;
          let nearest = 0, nearestDist = Infinity;
          logs.forEach((l, i) => {
            const d = Math.abs(xOf(l.date) - svgX);
            if (d < nearestDist) { nearestDist = d; nearest = i; }
          });
          setCursor(nearest);
        }}
        onTouchEnd={() => setCursor(null)}
      >
        {/* Grid + Y labels */}
        {yTicks.map((dispVal) => {
          const y = yOf(kgOfDisp(dispVal));
          if (y < pT - 2 || y > H - pB + 2) return null;
          return (
            <g key={dispVal}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#f0f0f0" strokeWidth="1" />
              <text x={pL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="#bbb">
                {fmtTick(dispVal)}
              </text>
            </g>
          );
        })}

        {/* Starting weight line */}
        {startKg && (
          <>
            <line
              x1={pL}
              y1={yOf(startKg)}
              x2={W - pR}
              y2={yOf(startKg)}
              stroke="#bbb"
              strokeWidth="1.2"
              strokeDasharray="5 3"
            />
            <text
              x={W - pR + 4}
              y={yOf(startKg) + 3.5}
              fontSize="9"
              fill="#bbb"
            >
              Start
            </text>
          </>
        )}

        {/* Goal weight line */}
        {targetKg && (
          <>
            <line
              x1={pL}
              y1={yOf(targetKg)}
              x2={W - pR}
              y2={yOf(targetKg)}
              stroke={goalColor}
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            <text
              x={W - pR + 4}
              y={yOf(targetKg) + 3.5}
              fontSize="9"
              fill={goalColor}
              fontWeight="600"
            >
              Goal
            </text>
          </>
        )}

        {/* Weight trend line */}
        {logs.length > 1 && (
          <polyline
            points={pts}
            fill="none"
            stroke="#ff8c42"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Weight dots */}
        {logs.map((l, i) => (
          <circle
            key={i}
            cx={xOf(l.date)}
            cy={yOf(l.weight_kg)}
            r="3.5"
            fill="#ff8c42"
            stroke="#fff"
            strokeWidth="1.5"
          />
        ))}

        {/* X axis labels */}
        <text x={pL} y={H - 4} fontSize="9" fill="#ccc">
          {new Date(logs[0].date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </text>
        {logs.length > 1 && (
          <text x={W - pR} y={H - 4} textAnchor="end" fontSize="9" fill="#ccc">
            {new Date(
              logs[logs.length - 1].date + "T00:00:00",
            ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        )}

        {/* Interactive cursor tooltip */}
        {cursor !== null && (() => {
          const log = logs[cursor];
          const cx = xOf(log.date);
          const cy = yOf(log.weight_kg);
          const dateLabel = new Date(log.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const weightLabel = `${toDisp(log.weight_kg)} ${unitLabel}`;
          const tipW = 96, tipH = 40, tipR = 7;
          let tipX = cx - tipW / 2;
          if (tipX < pL) tipX = pL;
          if (tipX + tipW > W - pR) tipX = W - pR - tipW;
          const tipY = cy - tipH - 12 < pT ? cy + 14 : cy - tipH - 12;
          return (
            <g pointerEvents="none">
              <line x1={cx} y1={pT} x2={cx} y2={H - pB} stroke="#bbb" strokeWidth="1" strokeDasharray="4 3" />
              <circle cx={cx} cy={cy} r="6" fill="#ff8c42" stroke="#fff" strokeWidth="2.5" />
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={tipR} ry={tipR} fill="rgba(40,40,40,0.9)" />
              <text x={tipX + tipW / 2} y={tipY + 15} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">{weightLabel}</text>
              <text x={tipX + tipW / 2} y={tipY + 30} textAnchor="middle" fontSize="10" fill="#ccc">{dateLabel}</text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <LegendItem color="#ff8c42" label="Weight" solid />
        {startKg && <LegendItem color="#bbb" label="Start" />}
        {targetKg && <LegendItem color={goalColor} label="Goal" />}
      </div>
    </div>
  );
}

function LegendItem({ color, label, solid }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: "#888",
      }}
    >
      <svg width="20" height="2" style={{ overflow: "visible" }}>
        <line
          x1="0"
          y1="1"
          x2="20"
          y2="1"
          stroke={color}
          strokeWidth={solid ? 2.5 : 1.5}
          strokeDasharray={solid ? undefined : "4 2"}
        />
      </svg>
      {label}
    </div>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "20px 20px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>{title}</h3>
        {action}
      </div>
      {subtitle && (
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#888" }}>
          {subtitle}
        </p>
      )}
      {!subtitle && <div style={{ marginBottom: 14 }} />}
      {children}
    </div>
  );
}

function FieldRow({ label, unit, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#333" }}>
        {label}
      </span>
      {children}
      {unit && (
        <span style={{ fontSize: 12, color: "#aaa", width: 26 }}>{unit}</span>
      )}
    </div>
  );
}

const unitToggle = {
  border: "none",
  borderRadius: 6,
  padding: "3px 7px",
  fontSize: 11,
  cursor: "pointer",
  fontWeight: 600,
};
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#555" };
const numInput = {
  padding: "7px 10px",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  fontSize: 16,
  outline: "none",
  textAlign: "right",
  background: "#fafafa",
  width: 80,
};
const chipBtn = {
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
};
