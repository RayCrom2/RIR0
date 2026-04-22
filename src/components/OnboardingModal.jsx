import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal", default: 2000, color: "#ff8c42" },
  { key: "protein",  label: "Protein",  unit: "g",    default: 150,  color: "#4f8ef7" },
  { key: "carbs",    label: "Carbs",    unit: "g",    default: 250,  color: "#f7c948" },
  { key: "fat",      label: "Fat",      unit: "g",    default: 65,   color: "#e05c5c" },
  { key: "fiber",    label: "Fiber",    unit: "g",    default: 25,   color: "#5cb85c" },
  { key: "sugar",    label: "Sugar",    unit: "g",    default: 50,   color: "#c87dd4" },
];

export default function OnboardingModal() {
  const { user, needsOnboarding, setNeedsOnboarding } = useAuth();
  const [goals, setGoals] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.default]))
  );
  const [saving, setSaving] = useState(false);

  if (!needsOnboarding) return null;

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("nutrition_goals")
      .upsert({ user_id: user.id, ...goals }, { onConflict: "user_id" });
    setNeedsOnboarding(false);
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        padding: "32px 28px", width: "100%", maxWidth: 440,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>🎯</span>
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>
          Set your daily goals
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888" }}>
          These targets appear on your Nutrition tracker. You can change them anytime from your Profile.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {FIELDS.map((f) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: f.color, flexShrink: 0,
              }} />
              <label style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#333" }}>
                {f.label}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  value={goals[f.key]}
                  onChange={(e) => setGoals((g) => ({ ...g, [f.key]: Number(e.target.value) }))}
                  style={{
                    width: 80, padding: "7px 10px",
                    border: "1px solid #e0e0e0", borderRadius: 8,
                    fontSize: 14, outline: "none", textAlign: "right",
                    background: "#fafafa",
                  }}
                />
                <span style={{ fontSize: 13, color: "#aaa", width: 28 }}>{f.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", background: "#ff8c42", color: "#fff",
            border: "none", borderRadius: 10, padding: "12px 0",
            fontWeight: 700, fontSize: 15, cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Get Started"}
        </button>
      </div>
    </div>
  );
}
