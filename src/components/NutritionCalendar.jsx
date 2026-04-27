import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const MACROS = [
  { key: "calories", label: "Calories", unit: "kcal", color: "#ff8c42" },
  { key: "protein",  label: "Protein",  unit: "g",    color: "#4f8ef7" },
  { key: "carbs",    label: "Carbs",    unit: "g",    color: "#f7c948" },
  { key: "fat",      label: "Fat",      unit: "g",    color: "#e05c5c" },
  { key: "fiber",    label: "Fiber",    unit: "g",    color: "#5cb85c" },
  { key: "sugar",    label: "Sugar",    unit: "g",    color: "#c87dd4" },
];

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(year, month, day) { return `${year}-${pad(month + 1)}-${pad(day)}`; }

function computeStreak(goalsByDate) {
  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);
  cursor.setDate(cursor.getDate() - 1); // must include previous day
  while (true) {
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    if (!goalsByDate[key]) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function NutritionCalendar({ userId, onClose }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [logsByDate, setLogsByDate] = useState({});
  const [statusByDate, setStatusByDate] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedEntryId, setExpandedEntryId] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const start = ymd(year, month, 1);
    const endDate = new Date(year, month + 1, 1);
    const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-01`;
    Promise.all([
      supabase.from("nutrition_logs").select("*").eq("user_id", userId).gte("logged_at", start).lt("logged_at", end),
      supabase.from("daily_goal_status").select("date, met").eq("user_id", userId).gte("date", start).lt("date", end),
    ]).then(([{ data: logs }, { data: statuses }]) => {
      const grouped = {};
      for (const entry of logs || []) {
        const d = entry.logged_at.slice(0, 10);
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(entry);
      }
      setLogsByDate(grouped);
      const statusMap = {};
      for (const s of statuses || []) statusMap[s.date] = s.met;
      setStatusByDate(statusMap);
      setLoading(false);
    });
  }, [userId, year, month]);

  const streak = computeStreak(statusByDate);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    const nowMonth = now.getMonth(), nowYear = now.getFullYear();
    if (year === nowYear && month === nowMonth) return; // don't go into future
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
  const selectedKey = selectedDay ? ymd(year, month, selectedDay) : null;
  const selectedEntries = selectedKey ? (logsByDate[selectedKey] || []) : [];
  const selectedTotals = MACROS.reduce((acc, m) => {
    acc[m.key] = Math.round(selectedEntries.reduce((s, e) => s + (e[m.key] || 0), 0) * 10) / 10;
    return acc;
  }, {});

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        width: "100%", maxWidth: 480,
        padding: "20px 20px 24px",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{monthName} {year}</span>
            {streak > 0 && (
              <div style={{ fontSize: 12, color: "#ff8c42", fontWeight: 600, marginTop: 2 }}>
                🔥 {streak}-day streak
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={nextMonth} disabled={isFutureMonth} style={{ ...navBtn, opacity: isFutureMonth ? 0.3 : 1 }}>›</button>
            <button onClick={onClose} style={{ ...navBtn, fontSize: 16, color: "#aaa" }}>✕</button>
          </div>
        </div>

        {/* Day-of-week labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#aaa", fontWeight: 600, padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const key = ymd(year, month, day);
            const hasLogs = !!(logsByDate[key]?.length);
            const metGoals = statusByDate[key] ?? false;
            const isToday = key === todayKey;
            const isSelected = selectedDay === day;
            const isFuture = key > todayKey;
            return (
              <button
                key={day}
                onClick={() => { if (isFuture) return; setSelectedDay(selectedDay === day ? null : day); setExpandedEntryId(null); }}
                style={{
                  borderRadius: 8,
                  border: isSelected ? "2px solid #ff8c42" : "2px solid transparent",
                  background: isSelected ? "#fff5ee" : isToday ? "#f7f7fb" : "#fafafa",
                  padding: "6px 2px 4px",
                  cursor: isFuture ? "default" : "pointer",
                  opacity: isFuture ? 0.35 : 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "#ff8c42" : "#333" }}>
                  {day}
                </span>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: hasLogs ? (metGoals ? "#5cb85c" : "#e05c5c") : "transparent",
                }} />
              </button>
            );
          })}
        </div>

        {/* Selected day log */}
        {selectedDay && (
          <div style={{ marginTop: 20, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {monthName} {selectedDay}
              </span>
              <span style={{ fontSize: 12, color: "#aaa" }}>
                {selectedEntries.length} {selectedEntries.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            {selectedEntries.length === 0 ? (
              <p style={{ color: "#bbb", fontSize: 13, textAlign: "center", margin: "12px 0" }}>No entries logged</p>
            ) : (
              <>
                {/* Totals */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {MACROS.map(m => (
                    <div key={m.key} style={{ background: "#f7f7fb", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>
                      <span style={{ color: "#888" }}>{m.label} </span>
                      <span style={{ fontWeight: 700, color: m.color }}>{selectedTotals[m.key]}{m.unit === "kcal" ? " kcal" : m.unit}</span>
                    </div>
                  ))}
                </div>

                {/* Entry list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {selectedEntries.map(e => {
                    const isExpanded = expandedEntryId === e.id;
                    return (
                      <div key={e.id} style={{ background: "#fafafa", borderRadius: 8, overflow: "hidden", border: "1px solid #f0f0f0" }}>
                        <button
                          onClick={() => setExpandedEntryId(isExpanded ? null : e.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "left" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 11, color: "#bbb", transform: isExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▶</span>
                            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.food_name}</span>
                            {e.serving_amount && (
                              <span style={{ color: "#aaa", fontSize: 11, flexShrink: 0 }}>
                                {e.serving_amount}{e.serving_unit || ""}
                              </span>
                            )}
                          </div>
                          <span style={{ color: "#ff8c42", fontWeight: 700, fontSize: 12, flexShrink: 0, marginLeft: 8 }}>{e.calories} kcal</span>
                        </button>
                        {isExpanded && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px 10px" }}>
                            {MACROS.filter(m => m.key !== "calories").map(m => (
                              e[m.key] > 0 && (
                                <div key={m.key} style={{ fontSize: 11, background: "#fff", border: "1px solid #f0f0f0", borderRadius: 6, padding: "3px 8px" }}>
                                  <span style={{ color: "#888" }}>{m.label} </span>
                                  <span style={{ fontWeight: 700, color: m.color }}>{Math.round(e[m.key] * 10) / 10}{m.unit}</span>
                                </div>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {loading && (
          <p style={{ textAlign: "center", color: "#bbb", fontSize: 13, marginTop: 16 }}>Loading…</p>
        )}
      </div>
    </div>
  );
}

const navBtn = {
  background: "none", border: "none", fontSize: 22, cursor: "pointer",
  color: "#555", padding: "2px 8px", borderRadius: 6, lineHeight: 1,
};
