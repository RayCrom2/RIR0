import { useState, useRef, useEffect } from "react";
import muscles from "../data/muscles.js";
import { LuCalendar } from "react-icons/lu";
import { monthAbbr } from "./Nutrition.jsx";

const ROUTINES_KEY = "exercise_routines";

// Deduplicated list of all exercises from muscles.js
const ALL_EXERCISES = [
  ...new Set(
    Object.values(muscles).flatMap((m) => [
      ...(m.exercises || []),
      ...(m.parts || []).flatMap((p) => p.exercises || []),
    ]),
  ),
].sort();

export default function ExerciseLogger() {
  const [view, setView] = useState("select");

  // ── routines (persisted)
  const [routines, setRoutines] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ROUTINES_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // ── create-routine state
  // cExs shape: [{ name, unit, sets: [{ reps, weight, rir }] }]
  const [cName, setCName] = useState("");
  const [cExs, setCExs] = useState([]);
  const [cSearch, setCSearch] = useState("");
  const [cDropdownOpen, setCDropdownOpen] = useState(false);
  const [cError, setCError] = useState("");
  const cSearchRef = useRef(null);

  // ── session state
  // sessionExs shape: [{ name, unit, sets: [{ reps, weight, rir, done }] }]
  const [sessionName, setSessionName] = useState("");
  const [sessionSource, setSessionSource] = useState("free");
  const [sessionExs, setSessionExs] = useState([]);
  const [sSearch, setSSearch] = useState("");
  const [sDropdownOpen, setSDropdownOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [saveName, setSaveName] = useState("");
  const sSearchRef = useRef(null);

  // Derived session stats — only count sets marked done
  const doneSets = sessionExs.flatMap((ex) => ex.sets.filter((s) => s.done));
  const totalSets = doneSets.length;
  const uniqueEx = new Set(
    sessionExs.filter((ex) => ex.sets.some((s) => s.done)).map((ex) => ex.name),
  ).size;
  const totalVol = doneSets.reduce((sum, s) => {
    const w = Number(s.weight),
      r = Number(s.reps);
    return sum + (w > 0 && r > 0 ? w * r : 0);
  }, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Close both search dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (cSearchRef.current && !cSearchRef.current.contains(e.target))
        setCDropdownOpen(false);
      if (sSearchRef.current && !sSearchRef.current.contains(e.target))
        setSDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── helpers
  function persistRoutines(next) {
    setRoutines(next);
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(next));
  }

  // ── select actions
  function goCreate() {
    setCName("");
    setCExs([]);
    setCSearch("");
    setCDropdownOpen(false);
    setCError("");
    setView("create");
  }
  function goFreeSession() {
    setSessionName("New Workout");
    setSessionSource("free");
    setSessionExs([]);
    setSSearch("");
    setSDropdownOpen(false);
    setEnding(false);
    setSaveName("");
    setView("session");
  }
  function goRoutineSession(r) {
    setSessionName(r.name);
    setSessionSource("routine");
    // Pre-populate exercise cards from the saved routine
    const initialExs = r.exercises.map((ex) => {
      const sets = Array.isArray(ex.sets)
        ? ex.sets.map((s) => ({
            reps: String(s.reps != null ? s.reps : ""),
            weight: String(s.weight != null ? s.weight : ""),
            rir: String(s.rir != null ? s.rir : ""),
            done: false,
          }))
        : [
            {
              reps: String(ex.reps || ""),
              weight: String(ex.weight != null ? ex.weight : ""),
              rir: String(ex.rir != null ? ex.rir : ""),
              done: false,
            },
          ];
      return { name: ex.name, unit: ex.unit || "lbs", sets };
    });
    setSessionExs(initialExs);
    setSSearch("");
    setSDropdownOpen(false);
    setEnding(false);
    setSaveName(r.name);
    setView("session");
  }
  function deleteRoutine(id) {
    if (window.confirm("Delete this routine?"))
      persistRoutines(routines.filter((r) => r.id !== id));
  }

  // ── create-routine: search
  const cSearchResults = cSearch.trim()
    ? ALL_EXERCISES.filter((ex) =>
        ex.toLowerCase().includes(cSearch.toLowerCase()),
      )
    : [];

  function cAddExercise(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (cExs.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())) {
      setCSearch("");
      setCDropdownOpen(false);
      return;
    }
    setCExs((prev) => [
      ...prev,
      { name: trimmed, unit: "lbs", sets: [{ reps: "", weight: "", rir: "" }] },
    ]);
    setCSearch("");
    setCDropdownOpen(false);
    setCError("");
  }
  function cHandleSearchKey(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (cSearchResults.length > 0) cAddExercise(cSearchResults[0]);
    else if (cSearch.trim()) cAddExercise(cSearch);
  }
  function cAddSet(exIdx) {
    setCExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }],
        };
      }),
    );
  }
  function cRemoveSet(exIdx, setIdx) {
    setCExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      }),
    );
  }
  function cUpdateSet(exIdx, setIdx, field, value) {
    setCExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) =>
            j !== setIdx ? s : { ...s, [field]: value },
          ),
        };
      }),
    );
  }
  function cUpdateUnit(exIdx, value) {
    setCExs((prev) =>
      prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, unit: value })),
    );
  }
  function cRemoveEx(exIdx) {
    setCExs((prev) => prev.filter((_, i) => i !== exIdx));
  }
  function cSave() {
    if (!cName.trim()) {
      setCError("Routine name is required.");
      return;
    }
    if (cExs.length === 0) {
      setCError("Add at least one exercise.");
      return;
    }
    const exercises = cExs.map((ex) => ({
      name: ex.name,
      unit: ex.unit,
      sets: ex.sets.map((s) => ({
        reps: Number(s.reps) || 1,
        weight: s.weight !== "" ? Number(s.weight) : null,
        rir: s.rir !== "" ? Number(s.rir) : null,
      })),
    }));
    persistRoutines([
      ...routines,
      { id: String(Date.now()), name: cName.trim(), exercises },
    ]);
    setView("select");
  }

  // ── session: search
  const sSearchResults = sSearch.trim()
    ? ALL_EXERCISES.filter((ex) =>
        ex.toLowerCase().includes(sSearch.toLowerCase()),
      )
    : [];

  function sAddExercise(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (
      sessionExs.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSSearch("");
      setSDropdownOpen(false);
      return;
    }
    setSessionExs((prev) => [
      ...prev,
      {
        name: trimmed,
        unit: "lbs",
        sets: [{ reps: "", weight: "", rir: "", done: false }],
      },
    ]);
    setSSearch("");
    setSDropdownOpen(false);
  }
  function sHandleSearchKey(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (sSearchResults.length > 0) sAddExercise(sSearchResults[0]);
    else if (sSearch.trim()) sAddExercise(sSearch);
  }
  function sAddSet(exIdx) {
    setSessionExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { ...last, done: false }] };
      }),
    );
  }
  function sRemoveSet(exIdx, setIdx) {
    setSessionExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      }),
    );
  }
  function sUpdateSet(exIdx, setIdx, field, value) {
    setSessionExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) =>
            j !== setIdx ? s : { ...s, [field]: value },
          ),
        };
      }),
    );
  }
  function sToggleDone(exIdx, setIdx) {
    setSessionExs((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) =>
            j !== setIdx ? s : { ...s, done: !s.done },
          ),
        };
      }),
    );
  }
  function sUpdateUnit(exIdx, value) {
    setSessionExs((prev) =>
      prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, unit: value })),
    );
  }
  function sRemoveEx(exIdx) {
    setSessionExs((prev) => prev.filter((_, i) => i !== exIdx));
  }
  function doSaveAsRoutine() {
    if (!saveName.trim()) return;
    const exercises = sessionExs.map((ex) => ({
      name: ex.name,
      unit: ex.unit,
      sets: ex.sets.map(({ done: _, ...s }) => ({
        reps: Number(s.reps) || 1,
        weight: s.weight !== "" ? Number(s.weight) : null,
        rir: s.rir !== "" ? Number(s.rir) : null,
      })),
    }));
    persistRoutines([
      ...routines,
      { id: String(Date.now()), name: saveName.trim(), exercises },
    ]);
    finishSession();
  }
  function finishSession() {
    setView("select");
    setEnding(false);
    setSessionExs([]);
  }

  // ═══════════════════════════════════════════════
  // SELECT VIEW
  // ═══════════════════════════════════════════════
  if (view === "select")
    return (
      <div className="max-w-[860px] mx-auto px-2">
        <div style={{ display: "flex" }}>
          <p className="font-bold text-[2rem] mb-1">Exercise Logger</p>
          <button className="relative inline-flex items-center justify-center ml-auto cursor-pointer">
            <LuCalendar size={45} />
            <span className="absolute bottom-[15px] text-[11px] font-bold leading-none">
              {monthAbbr}
            </span>
          </button>
        </div>
        <p className="text-[#888] mb-6 text-sm">{today}</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={goCreate}
            className="bg-white border-2 border-dashed border-[#e0e0e0] rounded-xl p-7 cursor-pointer text-left shadow-sm hover:border-[#ff8c42]"
          >
            <div className="text-[26px] mb-2.5">📋</div>
            <div className="text-base font-bold text-[#333]">
              Create Routine
            </div>
            <div className="text-[13px] text-[#aaa] mt-1.5 leading-snug">
              Build a named template with exercises to reuse later
            </div>
          </button>
          <button
            onClick={goFreeSession}
            className="bg-[#ff8c42] border-0 rounded-xl p-7 cursor-pointer text-left shadow-[0_4px_16px_rgba(255,140,66,0.35)]"
          >
            <div className="text-[26px] mb-2.5">⚡</div>
            <div className="text-base font-bold text-white">New Workout</div>
            <div className="text-[13px] text-white/85 mt-1.5 leading-snug">
              Log exercises as you go — option to save as a routine when done
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-[13px] font-semibold text-[#888] uppercase tracking-[0.05em]">
            My Routines
          </span>
          <span className="text-xs text-[#ccc]">({routines.length})</span>
        </div>

        {routines.length === 0 ? (
          <div className="bg-white rounded-xl py-9 text-center text-[#bbb] text-sm shadow-sm">
            No routines yet — create your first one above.
          </div>
        ) : (
          routines.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl px-5 py-4 mb-2.5 shadow-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-bold text-[15px]">{r.name}</div>
                <div className="text-xs text-[#aaa] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  {r.exercises.length} exercise
                  {r.exercises.length !== 1 ? "s" : ""}:{" "}
                  {r.exercises.map((e) => e.name).join(", ")}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => goRoutineSession(r)}
                  className="bg-[#ff8c42] text-white border-0 rounded-lg px-4 py-1.5 cursor-pointer font-semibold text-[13px]"
                >
                  ▶ Start
                </button>
                <button
                  onClick={() => deleteRoutine(r.id)}
                  className="bg-transparent border-0 cursor-pointer text-[#ccc] text-base px-1.5 py-1"
                  title="Delete routine"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );

  // ═══════════════════════════════════════════════
  // CREATE ROUTINE VIEW
  // ═══════════════════════════════════════════════
  if (view === "create")
    return (
      <div className="max-w-[860px] mx-auto px-2">
        <div className="flex items-center gap-3.5 mb-1">
          <button
            onClick={() => setView("select")}
            className="bg-transparent border border-[#e0e0e0] rounded-lg px-3.5 py-1.5 cursor-pointer text-[13px] text-[#555]"
          >
            ← Back
          </button>
          <h2>Create Routine</h2>
        </div>
        <p className="text-[#888] mb-6 text-sm">
          Build a reusable workout template
        </p>

        {/* Routine name */}
        <div className="bg-white rounded-xl px-6 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.07)] mb-5">
          <label className="text-[13px] font-semibold text-[#555] block mb-2">
            Routine Name *
          </label>
          <input
            value={cName}
            onChange={(e) => {
              setCName(e.target.value);
              setCError("");
            }}
            placeholder="e.g. Push Day, Full Body, Upper/Lower…"
            className="py-2.5 px-3 border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0 w-full box-border"
          />
        </div>

        {/* Exercise search */}
        <div className="bg-white rounded-xl px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.07)] mb-4">
          <div ref={cSearchRef} className="relative">
            <input
              value={cSearch}
              onChange={(e) => {
                setCSearch(e.target.value);
                setCDropdownOpen(true);
                setCError("");
              }}
              onKeyDown={cHandleSearchKey}
              onFocus={() => setCDropdownOpen(true)}
              placeholder="Search exercises or type a custom name…"
              className="py-2.5 px-3 border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0 w-full box-border pl-9"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-[#aaa]">
              🔍
            </span>
            {cDropdownOpen && cSearch.trim() && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#e8e8e8] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] z-[100] max-h-[220px] overflow-y-auto">
                {cSearchResults.length > 0 ? (
                  cSearchResults.map((ex) => (
                    <button
                      key={ex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        cAddExercise(ex);
                      }}
                      className="w-full text-left bg-transparent border-0 px-3.5 py-2.5 cursor-pointer text-sm text-[#333] block hover:bg-[#fff8f2]"
                    >
                      {ex}
                    </button>
                  ))
                ) : (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      cAddExercise(cSearch);
                    }}
                    className="w-full text-left bg-transparent border-0 px-3.5 py-2.5 cursor-pointer text-sm text-[#ff8c42] block"
                  >
                    + Add &ldquo;{cSearch}&rdquo; as custom exercise
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Exercise cards */}
        {cExs.length > 0 && (
          <div className="mb-6">
            {cExs.map((ex, exIdx) => (
              <ExerciseCard
                key={exIdx}
                ex={ex}
                showDone={false}
                onUpdateSet={(si, field, val) =>
                  cUpdateSet(exIdx, si, field, val)
                }
                onRemoveSet={(si) => cRemoveSet(exIdx, si)}
                onAddSet={() => cAddSet(exIdx)}
                onUpdateUnit={(val) => cUpdateUnit(exIdx, val)}
                onRemove={() => cRemoveEx(exIdx)}
              />
            ))}
          </div>
        )}

        {cError && <p className="text-[#e05c5c] mb-3 text-[13px]">{cError}</p>}

        <button
          onClick={cSave}
          className="bg-[#ff8c42] text-white border-0 rounded-xl px-8 py-3 font-bold cursor-pointer text-[15px]"
        >
          Save Routine
        </button>
      </div>
    );

  // ═══════════════════════════════════════════════
  // SESSION VIEW
  // ═══════════════════════════════════════════════
  return (
    <div className="max-w-[860px] mx-auto px-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <h2>{sessionName}</h2>
          {sessionSource === "routine" && (
            <span className="text-[11px] font-semibold bg-[#f0f4ff] text-[#4f8ef7] rounded-[5px] px-2 py-0.5 shrink-0">
              ROUTINE
            </span>
          )}
        </div>
        {!ending && (
          <button
            onClick={() => sessionExs.length === 0 ? finishSession() : setEnding(true)}
            className="bg-transparent border border-[#e0e0e0] rounded-lg px-4 py-1.5 cursor-pointer text-[13px] text-[#555] font-semibold shrink-0"
          >
            End Session
          </button>
        )}
      </div>
      <p className="text-[#888] mb-6 text-sm">{today}</p>

      {/* End session panel */}
      {ending && (
        <div className="bg-white rounded-xl px-6 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.07)] mb-6 border-2 border-[#ff8c42]">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3>Finish Workout</h3>
              <p className="text-[13px] text-[#888] m-0">
                {uniqueEx} exercise{uniqueEx !== 1 ? "s" : ""} · {totalSets} set
                {totalSets !== 1 ? "s" : ""} completed
                {totalVol > 0 ? ` · ${totalVol.toLocaleString()} vol` : ""}
              </p>
            </div>
            <button
              onClick={() => setEnding(false)}
              className="bg-transparent border-0 cursor-pointer text-[#bbb] text-xl leading-none p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2.5 flex-wrap mb-3">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Routine name to save as…"
              className="py-2.5 px-3 border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0 flex-[1_1_200px]"
            />
            <button
              onClick={doSaveAsRoutine}
              disabled={!saveName.trim()}
              className={
                saveName.trim()
                  ? "bg-[#ff8c42] text-white border-0 rounded-lg px-5 py-2.5 font-semibold text-sm cursor-pointer"
                  : "bg-[#f0f0f0] text-[#aaa] border-0 rounded-lg px-5 py-2.5 font-semibold text-sm cursor-default"
              }
            >
              Save as Routine
            </button>
          </div>
          <button
            onClick={finishSession}
            className="bg-transparent border border-[#e0e0e0] rounded-lg px-4 py-2 cursor-pointer text-[13px] text-[#666]"
          >
            Finish Without Saving
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            label: "Exercises",
            value: uniqueEx,
            sub: "with completed sets",
            color: "#ff8c42",
          },
          {
            label: "Sets Done",
            value: totalSets,
            sub: "sets completed",
            color: "#4f8ef7",
          },
          {
            label: "Volume",
            value: totalVol > 0 ? totalVol.toLocaleString() : "—",
            sub: "weighted only",
            color: "#5cb85c",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.07)] text-center"
            style={{ borderTop: `4px solid ${card.color}` }}
          >
            <div
              className="text-[26px] font-bold"
              style={{ color: card.color }}
            >
              {card.value}
            </div>
            <div className="text-[11px] text-[#aaa] mt-0.5">{card.sub}</div>
            <div className="text-[13px] font-semibold mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Add exercise search */}
      <div className="bg-white rounded-xl px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.07)] mb-4">
        <div ref={sSearchRef} className="relative">
          <input
            value={sSearch}
            onChange={(e) => {
              setSSearch(e.target.value);
              setSDropdownOpen(true);
            }}
            onKeyDown={sHandleSearchKey}
            onFocus={() => setSDropdownOpen(true)}
            placeholder="Search exercises or type a custom name…"
            className="py-2.5 px-3 border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0 w-full box-border pl-9"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-[#aaa]">
            🔍
          </span>
          {sDropdownOpen && sSearch.trim() && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#e8e8e8] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] z-[100] max-h-[220px] overflow-y-auto">
              {sSearchResults.length > 0 ? (
                sSearchResults.map((ex) => (
                  <button
                    key={ex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      sAddExercise(ex);
                    }}
                    className="w-full text-left bg-transparent border-0 px-3.5 py-2.5 cursor-pointer text-sm text-[#333] block hover:bg-[#fff8f2]"
                  >
                    {ex}
                  </button>
                ))
              ) : (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    sAddExercise(sSearch);
                  }}
                  className="w-full text-left bg-transparent border-0 px-3.5 py-2.5 cursor-pointer text-sm text-[#ff8c42] block"
                >
                  + Add &ldquo;{sSearch}&rdquo; as custom exercise
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exercise cards */}
      {sessionExs.length === 0 ? (
        <div className="bg-white rounded-xl py-10 text-center text-[#bbb] text-sm shadow-sm">
          Search for an exercise above to get started.
        </div>
      ) : (
        sessionExs.map((ex, exIdx) => (
          <ExerciseCard
            key={exIdx}
            ex={ex}
            showDone={true}
            onUpdateSet={(si, field, val) => sUpdateSet(exIdx, si, field, val)}
            onRemoveSet={(si) => sRemoveSet(exIdx, si)}
            onAddSet={() => sAddSet(exIdx)}
            onUpdateUnit={(val) => sUpdateUnit(exIdx, val)}
            onRemove={() => sRemoveEx(exIdx)}
            onToggleDone={(si) => sToggleDone(exIdx, si)}
          />
        ))
      )}
    </div>
  );
}

// ── Shared exercise card component
function ExerciseCard({
  ex,
  showDone,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
  onUpdateUnit,
  onRemove,
  onToggleDone,
}) {
  const colGrid = showDone
    ? "grid-cols-[32px_40px_1fr_1fr_1fr_24px]"
    : "grid-cols-[40px_1fr_1fr_1fr_24px]";

  return (
    <div className="bg-white rounded-xl px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.07)] mb-3">
      {/* Exercise header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-[15px] text-[#222]">{ex.name}</span>
        <div className="flex items-center gap-2">
          <select
            value={ex.unit}
            onChange={(e) => onUpdateUnit(e.target.value)}
            className="py-1.5 px-2 text-[13px] cursor-pointer w-16 border border-[#e0e0e0] rounded-lg bg-[#fafafa] outline-none"
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
          <button
            onClick={onRemove}
            className="bg-transparent border-0 cursor-pointer text-[#ccc] text-base px-1 py-0.5 leading-none"
            title="Remove exercise"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Column labels */}
      <div className={`grid ${colGrid} gap-1.5 mb-1`}>
        {showDone && <span />}
        <span />
        <span className="text-[11px] text-[#bbb] font-semibold text-center">
          REPS
        </span>
        <span className="text-[11px] text-[#bbb] font-semibold text-center">
          WEIGHT
        </span>
        <span className="text-[11px] text-[#bbb] font-semibold text-center">
          RIR
        </span>
        <span />
      </div>

      {/* Set rows */}
      {ex.sets.map((s, si) => {
        const done = showDone && s.done;
        return (
          <div
            key={si}
            className={`grid ${colGrid} gap-1.5 mb-1.5 items-center transition-colors${done ? " bg-[#f0fdf4] rounded-lg px-1 py-0.5" : ""}`}
          >
            {showDone && (
              <button
                onClick={() => onToggleDone(si)}
                title={done ? "Mark incomplete" : "Mark complete"}
                className={
                  done
                    ? "w-[26px] h-[26px] rounded-full shrink-0 mx-auto cursor-pointer p-0 flex items-center justify-center text-white text-[13px] font-bold border-0 bg-[#5cb85c]"
                    : "w-[26px] h-[26px] rounded-full shrink-0 mx-auto cursor-pointer p-0 flex items-center justify-center text-white text-[13px] font-bold border-2 border-[#d0d0d0] bg-transparent"
                }
              >
                {done ? "✓" : ""}
              </button>
            )}
            <span className="text-xs text-[#aaa] font-semibold text-right pr-1">
              {si + 1}
            </span>
            <input
              type="number"
              min="1"
              placeholder="—"
              value={s.reps}
              onChange={(e) => onUpdateSet(si, "reps", e.target.value)}
              className={`py-[7px] px-1.5 text-center border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0${done ? " opacity-50" : ""}`}
            />
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="—"
              value={s.weight}
              onChange={(e) => onUpdateSet(si, "weight", e.target.value)}
              className={`py-[7px] px-1.5 text-center border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0${done ? " opacity-50" : ""}`}
            />
            <input
              type="number"
              min="0"
              max="10"
              placeholder="—"
              value={s.rir}
              onChange={(e) => onUpdateSet(si, "rir", e.target.value)}
              className={`py-[7px] px-1.5 text-center border border-[#e0e0e0] rounded-lg text-sm outline-none bg-[#fafafa] min-w-0${done ? " opacity-50" : ""}`}
            />
            <button
              onClick={() => onRemoveSet(si)}
              disabled={ex.sets.length === 1}
              className="bg-transparent border-0 text-[15px] p-0 leading-none text-[#ccc] cursor-pointer disabled:cursor-default disabled:text-[#eee]"
              title="Remove set"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Add set */}
      <button
        onClick={onAddSet}
        className="mt-1.5 bg-transparent border border-dashed border-[#e0e0e0] rounded-[7px] px-3.5 py-1.5 cursor-pointer text-[13px] text-[#888] hover:border-[#ff8c42] hover:text-[#ff8c42]"
      >
        + Add Set
      </button>
    </div>
  );
}
