import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal", color: "#ff8c42" },
  { key: "protein",  label: "Protein",  unit: "g",    color: "#4f8ef7" },
  { key: "carbs",    label: "Carbs",    unit: "g",    color: "#f7c948" },
  { key: "fat",      label: "Fat",      unit: "g",    color: "#e05c5c" },
  { key: "fiber",    label: "Fiber",    unit: "g",    color: "#5cb85c" },
  { key: "sugar",    label: "Sugar",    unit: "g",    color: "#c87dd4" },
];

const DEFAULT_GOALS = { calories: 2000, protein: 150, fat: 65, carbs: 250, fiber: 25, sugar: 50 };

export default function Profile() {
  const { user } = useAuth();
  const [goals, setGoals] = useState(DEFAULT_GOALS);
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
        if (data) setGoals(data);
        setLoading(false);
      });
  }, [user]);

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
        <div style={{ minWidth: 0 }}>
          {displayName && displayName !== user.email && (
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 16, color: "#333" }}>
              {displayName}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 14, color: "#888", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Goals form */}
      <div style={{
        background: "#fff", borderRadius: 12,
        padding: "24px 20px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
      }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Daily Nutrition Goals</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
          These targets drive the progress bars on your Nutrition tracker.
        </p>

        {loading ? (
          <p style={{ color: "#bbb", fontSize: 14 }}>Loading…</p>
        ) : (
          <form onSubmit={handleSave}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
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
                      value={goals[f.key] ?? ""}
                      onChange={(e) => setGoals((g) => ({ ...g, [f.key]: Number(e.target.value) }))}
                      style={{
                        width: 88, padding: "8px 10px",
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
              {saving ? "Saving…" : saved ? "Saved!" : "Save Goals"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
