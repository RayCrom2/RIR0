import { supabase } from "./supabase";

function dateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchLoggedDaySummaries(userId) {
  const since = dateStr(-14);
  const { data } = await supabase
    .from("nutrition_logs")
    .select("logged_at, calories")
    .eq("user_id", userId)
    .eq("is_planned", false)
    .gte("logged_at", since)
    .order("logged_at");

  if (!data) return [];

  const byDay = {};
  for (const row of data) {
    const day = row.logged_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, totalCalories: 0, entries: 0 };
    byDay[day].totalCalories += row.calories || 0;
    byDay[day].entries += 1;
  }
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

export async function gatherCoachData(userId, goals, excludedDates = []) {
  const since = dateStr(-14);
  const weightSince = dateStr(-21);
  const excludedSet = new Set(excludedDates);

  const [weightResult, nutritionResult, statusResult] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("date, weight_kg")
      .eq("user_id", userId)
      .gte("date", weightSince)
      .order("date", { ascending: true }),
    supabase
      .from("nutrition_logs")
      .select("logged_at, calories, protein, carbs, fat, fiber, sugar")
      .eq("user_id", userId)
      .eq("is_planned", false)
      .gte("logged_at", since)
      .order("logged_at"),
    supabase
      .from("daily_goal_status")
      .select("date, met")
      .eq("user_id", userId)
      .gte("date", since),
  ]);

  const weightLogs = weightResult.data || [];
  const nutritionLogs = (nutritionResult.data || []).filter(
    (r) => !excludedSet.has(r.logged_at.slice(0, 10))
  );
  const statusRows = statusResult.data || [];

  // Weight: convert to user's preferred unit
  const weightUnit = goals?.preferred_weight_unit === "lbs" ? "lbs" : "kg";
  const toUnit = (kg) => kg == null ? null : weightUnit === "lbs"
    ? Math.round(kg * 2.20462 * 10) / 10
    : Math.round(kg * 10) / 10;

  const firstWeight = toUnit(weightLogs[0]?.weight_kg ?? null);
  const lastWeight = toUnit(weightLogs.at(-1)?.weight_kg ?? null);
  const firstDate = weightLogs[0] ? new Date(weightLogs[0].date) : null;
  const midWeight = (() => {
    if (!firstDate || weightLogs.length < 2) return null;
    let best = null, bestDiff = Infinity;
    for (const w of weightLogs) {
      const diff = Math.abs((new Date(w.date) - firstDate) / 86400000 - 7);
      if (diff < bestDiff) { bestDiff = diff; best = w.weight_kg; }
    }
    return toUnit(best);
  })();
  const deltaKg = (weightLogs.at(-1)?.weight_kg ?? 0) - (weightLogs[0]?.weight_kg ?? 0);
  const deltaDisplay = Math.abs(toUnit(deltaKg) ?? 0);
  const trendDirection = deltaDisplay < (weightUnit === "lbs" ? 0.5 : 0.2)
    ? "stable"
    : deltaKg < 0
    ? `down ${deltaDisplay.toFixed(1)} ${weightUnit}`
    : `up ${deltaDisplay.toFixed(1)} ${weightUnit}`;

  // Nutrition: aggregate by day, average over included days
  const byDay = {};
  for (const row of nutritionLogs) {
    const day = row.logged_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    byDay[day].calories += row.calories || 0;
    byDay[day].protein += row.protein || 0;
    byDay[day].carbs += row.carbs || 0;
    byDay[day].fat += row.fat || 0;
    byDay[day].fiber += row.fiber || 0;
    byDay[day].sugar += row.sugar || 0;
  }
  const days = Object.values(byDay);
  const includedDays = days.length;
  const avg = (key) =>
    includedDays > 0
      ? Math.round(days.reduce((s, d) => s + d[key], 0) / includedDays)
      : 0;

  // Goal adherence
  const includedStatus = statusRows.filter((r) => !excludedSet.has(r.date));
  const metDays = includedStatus.filter((r) => r.met).length;
  const adherencePct = includedStatus.length > 0
    ? Math.round((metDays / includedStatus.length) * 100)
    : 0;

  // Convert weight goal fields to display unit
  const goalsForAgent = {
    ...goals,
    weight_kg: toUnit(goals?.weight_kg),
    starting_weight_kg: toUnit(goals?.starting_weight_kg),
    target_weight_kg: toUnit(goals?.target_weight_kg),
  };

  return {
    weightLogs,
    firstWeight,
    midWeight,
    lastWeight,
    trendDirection,
    weightUnit,
    avgCalories: avg("calories"),
    avgProtein: avg("protein"),
    avgCarbs: avg("carbs"),
    avgFat: avg("fat"),
    includedDays,
    adherencePct,
    goals: goalsForAgent,
  };
}

export async function checkCoachThreshold(userId) {
  const since = dateStr(-14);
  const { data } = await supabase
    .from("weight_logs")
    .select("date")
    .eq("user_id", userId)
    .gte("date", since);

  return (data || []).length >= 3;
}
