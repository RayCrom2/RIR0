import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { key: "name",     label: "Food Name",    required: true  },
  { key: "calories", label: "Calories",     required: true  },
  { key: "protein",  label: "Protein (g)",  required: false },
  { key: "carbs",    label: "Carbs (g)",    required: false },
  { key: "fat",      label: "Fat (g)",      required: false },
  { key: "fiber",    label: "Fiber (g)",    required: false },
  { key: "sugar",    label: "Sugar (g)",    required: false },
];

const MACRO_KEYS = ["calories", "protein", "carbs", "fat", "fiber", "sugar"];

const MACRO_ROWS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein",  label: "Protein",  unit: "g"    },
  { key: "carbs",    label: "Carbs",    unit: "g"    },
  { key: "fat",      label: "Fat",      unit: "g"    },
  { key: "fiber",    label: "Fiber",    unit: "g"    },
  { key: "sugar",    label: "Sugar",    unit: "g"    },
];

const ALIASES = {
  name:     ["name", "food", "food name", "item", "description", "food item", "food description"],
  calories: ["calories", "kcal", "energy", "cal", "calories (kcal)", "energy (kcal)", "energy(kcal)"],
  protein:  ["protein", "protein (g)", "prot", "proteins"],
  carbs:    ["carbs", "carbohydrates", "carbohydrate", "net carbs", "carbs (g)", "carbohydrates (g)", "total carbohydrate (g)", "total carbohydrates (g)"],
  fat:      ["fat", "total fat", "fat (g)", "total fat (g)", "fats"],
  fiber:    ["fiber", "dietary fiber", "fibre", "fiber (g)", "dietary fiber (g)", "dietary fibre (g)"],
  sugar:    ["sugar", "sugars", "total sugars", "sugar (g)", "sugars (g)"],
};

const SOURCES = [
  { id: "sheets",     label: "Google Sheets", icon: "📊" },
  { id: "file",       label: "Upload File",   icon: "📁" },
  { id: "paste",      label: "Paste Data",    icon: "📋" },
  { id: "mfp",        label: "MyFitnessPal",  icon: "🍎" },
  { id: "cronometer", label: "Cronometer",    icon: "🔬" },
];

function macrosMatch(a, b) {
  return MACRO_KEYS.every(k => Number(a[k] || 0) === Number(b[k] || 0));
}

function autoMap(headers) {
  const result = {};
  for (const { key } of FIELDS) {
    const idx = headers.findIndex(h => ALIASES[key].includes(h.toLowerCase().trim()));
    result[key] = idx >= 0 ? String(idx) : "";
  }
  return result;
}

async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parsePaste(text) {
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

async function fetchSheets(url) {
  let csvUrl;
  if (url.includes("/pub?") || url.includes("output=csv")) {
    const u = new URL(url);
    u.searchParams.set("output", "csv");
    csvUrl = u.toString();
  } else {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) throw new Error("Invalid Google Sheets URL");
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch?.[1] ?? "0";
    csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/pub?output=csv&gid=${gid}`;
  }
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error("Could not fetch sheet. Make sure it is published publicly (File → Share → Publish to web → CSV).");
  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("Sheet is not published publicly. Use File → Share → Publish to web → CSV.");
  }
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function applyMapping(rows, mapping) {
  return rows.slice(1)
    .map(row => ({
      name:     String(row[Number(mapping.name)]     ?? "").trim(),
      calories: Number(row[Number(mapping.calories)] ?? 0) || 0,
      protein:  mapping.protein  !== "" ? (Number(row[Number(mapping.protein)]  ?? 0) || 0) : 0,
      carbs:    mapping.carbs    !== "" ? (Number(row[Number(mapping.carbs)]    ?? 0) || 0) : 0,
      fat:      mapping.fat      !== "" ? (Number(row[Number(mapping.fat)]      ?? 0) || 0) : 0,
      fiber:    mapping.fiber    !== "" ? (Number(row[Number(mapping.fiber)]    ?? 0) || 0) : 0,
      sugar:    mapping.sugar    !== "" ? (Number(row[Number(mapping.sugar)]    ?? 0) || 0) : 0,
    }))
    .filter(f => f.name && f.calories > 0);
}

function FileDropzone({ onFile }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#ff8c42" : "#e0e0e0"}`,
        borderRadius: 10, padding: "28px 16px", textAlign: "center",
        cursor: "pointer", background: dragging ? "#fff8f2" : "#fafafa",
        transition: "all 0.15s",
      }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv,.tsv" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
      <div style={{ fontSize: 13, color: "#888" }}>Drop file here or <span style={{ color: "#ff8c42", fontWeight: 600 }}>browse</span></div>
      <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>Excel (.xlsx), CSV, or TSV</div>
    </div>
  );
}

export default function FoodImportModal({ open, onClose, onImported }) {
  const { user } = useAuth();
  const [step, setStep] = useState("source");
  const [sourceTab, setSourceTab] = useState("sheets");

  const [sheetsUrl, setSheetsUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [parsedFoods, setParsedFoods] = useState([]);
  const [selected, setSelected] = useState([]);

  // existingFoods: Map<lowercase name, { name, calories, protein, carbs, fat, fiber, sugar }>
  const [existingFoods, setExistingFoods] = useState(new Map());
  // cleanFoods: foods with no name match in library — ready to insert
  const [cleanFoods, setCleanFoods] = useState([]);
  // dupes: foods whose name matched but macros differ
  const [dupes, setDupes] = useState([]);
  const [dupeRes, setDupeRes] = useState({});
  const [dupeRenames, setDupeRenames] = useState({});

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("custom_foods")
      .select("name, calories, protein, carbs, fat, fiber, sugar")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const m = new Map();
          for (const f of data) m.set(f.name.toLowerCase().trim(), f);
          setExistingFoods(m);
        }
      });
  }, [open, user]);

  useEffect(() => {
    if (open) return;
    setStep("source"); setSheetsUrl(""); setPasteText("");
    setLoading(false); setError(""); setRawRows([]);
    setMapping({}); setParsedFoods([]); setSelected([]);
    setCleanFoods([]); setDupes([]); setDupeRes({}); setDupeRenames({});
    setImporting(false); setImportResult(null);
  }, [open]);

  function goToMapping(rows) {
    if (!rows || rows.length < 2) { setError("No data rows found in this source."); return; }
    setRawRows(rows);
    setMapping(autoMap(rows[0].map(String)));
    setError("");
    setStep("mapping");
  }

  async function loadSheets() {
    if (!sheetsUrl.trim()) { setError("Paste a URL first."); return; }
    setLoading(true); setError("");
    try { goToMapping(await fetchSheets(sheetsUrl.trim())); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadFile(file) {
    setLoading(true); setError("");
    try { goToMapping(await parseFile(file)); }
    catch (e) { setError("Could not read file: " + e.message); }
    finally { setLoading(false); }
  }

  function loadPaste() {
    if (!pasteText.trim()) { setError("Paste some data first."); return; }
    try { goToMapping(parsePaste(pasteText)); }
    catch (e) { setError("Could not parse: " + e.message); }
  }

  function confirmMapping() {
    if (mapping.name === "") { setError("Food Name column is required."); return; }
    if (mapping.calories === "") { setError("Calories column is required."); return; }
    const foods = applyMapping(rawRows, mapping);
    if (foods.length === 0) { setError("No valid rows found after mapping. Check column assignments."); return; }
    setParsedFoods(foods);
    setSelected(foods.map(() => true));
    setError("");
    setStep("preview");
  }

  function confirmPreview() {
    const chosen = parsedFoods.filter((_, i) => selected[i]);
    if (chosen.length === 0) { setError("Select at least one food."); return; }

    const clean = [], diffDupeList = [];
    for (const f of chosen) {
      const existing = existingFoods.get(f.name.toLowerCase().trim());
      if (!existing) {
        clean.push(f);
      } else if (!macrosMatch(existing, f)) {
        diffDupeList.push(f);
        // Same macros → silently skip (keep original), don't add anywhere
      }
    }

    setCleanFoods(clean);

    if (diffDupeList.length > 0) {
      setDupes(diffDupeList);
      const initRes = {}, initRenames = {};
      for (const f of diffDupeList) {
        initRes[f.name] = "skip";
        initRenames[f.name] = f.name + " (imported)";
      }
      setDupeRes(initRes); setDupeRenames(initRenames);
      setStep("duplicates");
    } else {
      runImport(clean, [], {}, {});
    }
  }

  async function runImport(clean, diffDupes, resolutions, renames) {
    setImporting(true);
    let added = 0, replaced = 0, skipped = 0;
    const toInsert = [...clean];
    const toReplace = [];

    for (const food of diffDupes) {
      const res = resolutions[food.name] ?? "skip";
      if (res === "skip") { skipped++; }
      else if (res === "replace") { toReplace.push(food); }
      else { toInsert.push({ ...food, name: renames[food.name] ?? (food.name + " (imported)") }); }
    }

    const newFoods = [];
    if (toInsert.length > 0) {
      const { data } = await supabase.from("custom_foods")
        .insert(toInsert.map(f => ({ user_id: user.id, name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, sugar: f.sugar })))
        .select();
      if (data) { newFoods.push(...data); added += data.length; }
    }
    for (const food of toReplace) {
      const { data } = await supabase.from("custom_foods")
        .update({ calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber, sugar: food.sugar })
        .eq("user_id", user.id).ilike("name", food.name).select();
      if (data) { newFoods.push(...data); replaced++; }
    }

    setImportResult({ added, replaced, skipped });
    setImporting(false);
    setStep("done");
    if (onImported) onImported(newFoods);
  }

  if (!open) return null;

  const headers = rawRows[0]?.map(String) ?? [];
  const colOptions = [
    <option key="" value="">— Skip —</option>,
    ...headers.map((h, i) => <option key={i} value={String(i)}>{h || `Column ${i + 1}`}</option>),
  ];
  const selectedCount = selected.filter(Boolean).length;

  // For preview: which selected foods are macro-different dupes (only those get the ⚠ warning)
  const isDiffDupe = f => {
    const ex = existingFoods.get(f.name.toLowerCase().trim());
    return ex && !macrosMatch(ex, f);
  };
  const hasDiffDupes = parsedFoods.some((f, i) => selected[i] && isDiffDupe(f));

  const overlay = { position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const modal = { background: "#fff", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" };
  const pBtn = { background: "#ff8c42", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
  const sBtn = { background: "#f7f7fb", color: "#555", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
  const inp = { padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fafafa", width: "100%", boxSizing: "border-box" };

  // ── SOURCE STEP
  if (step === "source") {
    const tabContent = () => {
      if (sourceTab === "sheets") return (
        <div>
          <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px" }}>
            Publish your Google Sheet and paste the URL below.
          </p>
          <div style={{ background: "#f7f7fb", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.6 }}>
            <strong>How to publish:</strong><br />
            1. In your sheet, go to <strong>File → Share → Publish to web</strong><br />
            2. Under "Link", select the sheet tab and choose <strong>Comma-separated values (.csv)</strong><br />
            3. Click <strong>Publish</strong> → copy the URL → paste below
          </div>
          <input style={inp} placeholder="https://docs.google.com/spreadsheets/d/…/pub?output=csv"
            value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && loadSheets()} />
        </div>
      );
      if (sourceTab === "file") return (
        <div>
          <p style={{ fontSize: 13, color: "#555", margin: "0 0 12px" }}>
            Upload an Excel (.xlsx), CSV, or TSV file. The first row should be column headers.
          </p>
          <FileDropzone onFile={loadFile} />
        </div>
      );
      if (sourceTab === "paste") return (
        <div>
          <p style={{ fontSize: 13, color: "#555", margin: "0 0 6px" }}>
            Copy columns from your spreadsheet (including headers) and paste below. Tab-separated and comma-separated are both supported.
          </p>
          <textarea
            style={{ ...inp, height: 160, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
            placeholder={"Name\tCalories\tProtein\nChicken Breast\t165\t31\nBrown Rice\t216\t4"}
            value={pasteText} onChange={e => setPasteText(e.target.value)}
          />
        </div>
      );
      if (sourceTab === "mfp") return (
        <div>
          <div style={{ background: "#f7f7fb", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.7 }}>
            <strong>How to export from MyFitnessPal:</strong><br />
            1. Log in at <strong>myfitnesspal.com</strong><br />
            2. Click <strong>Food</strong> in the top nav → <strong>Food Diary</strong><br />
            3. Click the green <strong>Export</strong> button in the top right<br />
            4. Select a date range → click <strong>Download CSV</strong><br />
            5. Upload the downloaded file below
          </div>
          <FileDropzone onFile={loadFile} />
        </div>
      );
      if (sourceTab === "cronometer") return (
        <div>
          <div style={{ background: "#f7f7fb", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.7 }}>
            <strong>Export diary foods from Cronometer:</strong><br />
            1. Log in at <strong>cronometer.com</strong><br />
            2. Click the <strong>Diary</strong> tab<br />
            3. Click <strong>Export</strong> (top right) → select <strong>Servings</strong><br />
            4. Choose a date range → click <strong>Export</strong><br />
            5. Upload the downloaded CSV below<br />
            <br />
            <strong>Or export Custom Foods only:</strong><br />
            1. Click your username → <strong>Custom Foods</strong><br />
            2. Click <strong>Export → CSV</strong> → upload below
          </div>
          <FileDropzone onFile={loadFile} />
        </div>
      );
    };

    const needsLoadBtn = sourceTab === "sheets" || sourceTab === "paste";
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700 }}>Import Foods</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Add foods to your library in bulk</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#bbb", lineHeight: 1, padding: 4 }}>✕</button>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }}>
            {SOURCES.map(s => (
              <button key={s.id} onClick={() => { setSourceTab(s.id); setError(""); }}
                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", background: sourceTab === s.id ? "#ff8c42" : "#f0f0f0", color: sourceTab === s.id ? "#fff" : "#666", transition: "all 0.15s" }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {tabContent()}

          {error && <p style={{ fontSize: 12, color: "#e05c5c", margin: "10px 0 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={onClose} style={sBtn}>Cancel</button>
            {needsLoadBtn && (
              <button onClick={sourceTab === "sheets" ? loadSheets : loadPaste}
                disabled={loading}
                style={{ ...pBtn, opacity: loading ? 0.6 : 1, flex: 1 }}>
                {loading ? "Loading…" : "Load Data →"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MAPPING STEP
  if (step === "mapping") {
    const sampleRows = rawRows.slice(1, 4);
    return (
      <div style={overlay}>
        <div style={modal}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700 }}>Map Columns</h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#888" }}>
            {headers.length} columns detected. Assign each field to a column.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {FIELDS.map(f => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 100, fontSize: 13, fontWeight: 600, color: "#333", flexShrink: 0 }}>
                  {f.label}{f.required && <span style={{ color: "#e05c5c" }}> *</span>}
                </span>
                <select value={mapping[f.key] ?? ""}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                  style={{ flex: 1, padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, outline: "none", background: "#fafafa", cursor: "pointer" }}>
                  {colOptions}
                </select>
              </div>
            ))}
          </div>

          {sampleRows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Data preview (first {sampleRows.length} rows)
              </p>
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f7f7fb" }}>
                      {headers.map((h, i) => (
                        <th key={i} style={{ padding: "6px 10px", textAlign: "left", color: "#888", fontWeight: 600, whiteSpace: "nowrap" }}>{h || `Col ${i + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, ri) => (
                      <tr key={ri} style={{ borderTop: "1px solid #f0f0f0" }}>
                        {headers.map((_, ci) => (
                          <td key={ci} style={{ padding: "5px 10px", color: "#555", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {String(row[ci] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: "#e05c5c", margin: "0 0 10px" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setStep("source"); setError(""); }} style={sBtn}>← Back</button>
            <button onClick={confirmMapping} style={{ ...pBtn, flex: 1 }}>Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── PREVIEW STEP
  if (step === "preview") {
    const allChecked = selected.every(Boolean);
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
              Preview — {parsedFoods.length} food{parsedFoods.length !== 1 ? "s" : ""} found
            </h2>
            <button
              onClick={() => setSelected(allChecked ? selected.map(() => false) : selected.map(() => true))}
              style={{ background: "none", border: "none", fontSize: 12, color: "#ff8c42", cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>
              {allChecked ? "Deselect all" : "Select all"}
            </button>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>
            {selectedCount} of {parsedFoods.length} selected for import.
          </p>

          <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto", border: "1px solid #f0f0f0", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "#f7f7fb", zIndex: 1 }}>
                <tr>
                  <th style={{ padding: "8px 10px", width: 32 }}></th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#888", fontWeight: 600 }}>Name</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#888", fontWeight: 600 }}>Cal</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#888", fontWeight: 600 }}>Pro</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#888", fontWeight: 600 }}>Carb</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#888", fontWeight: 600 }}>Fat</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#888", fontWeight: 600 }}>Fib</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#888", fontWeight: 600 }}>Sug</th>
                </tr>
              </thead>
              <tbody>
                {parsedFoods.map((f, i) => {
                  const diffDupe = isDiffDupe(f);
                  return (
                    <tr key={i} style={{ borderTop: "1px solid #f5f5f5", background: selected[i] ? "#fff" : "#fafafa", opacity: selected[i] ? 1 : 0.4 }}>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>
                        <input type="checkbox" checked={selected[i]}
                          onChange={e => setSelected(s => s.map((v, j) => j === i ? e.target.checked : v))}
                          style={{ cursor: "pointer", accentColor: "#ff8c42" }} />
                      </td>
                      <td style={{ padding: "7px 10px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {diffDupe && (
                          <span title="Exists in library with different values" style={{ color: "#f0a500", marginRight: 4, fontSize: 10 }}>⚠</span>
                        )}
                        {f.name}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{f.calories}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{f.protein || "—"}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{f.carbs || "—"}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{f.fat || "—"}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{f.fiber || "—"}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{f.sugar || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasDiffDupes && (
            <p style={{ fontSize: 12, color: "#f0a500", margin: "10px 0 0" }}>
              ⚠ Foods marked with ⚠ have different values from your existing library — you'll choose how to handle them next.
            </p>
          )}
          {error && <p style={{ fontSize: 12, color: "#e05c5c", margin: "10px 0 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => { setStep("mapping"); setError(""); }} style={sBtn}>← Back</button>
            <button onClick={confirmPreview} style={{ ...pBtn, flex: 1 }}>
              Import {selectedCount} food{selectedCount !== 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DUPLICATES STEP
  if (step === "duplicates") {
    return (
      <div style={overlay}>
        <div style={modal}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700 }}>
            Conflicting Foods ({dupes.length})
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#888" }}>
            These foods exist in your library with different values. Choose what to do with each.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20, maxHeight: 400, overflowY: "auto" }}>
            {dupes.map(f => {
              const existing = existingFoods.get(f.name.toLowerCase().trim());
              const res = dupeRes[f.name] ?? "skip";
              return (
                <div key={f.name} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: "14px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{f.name}</div>

                  {/* Side-by-side macro comparison */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                    <thead>
                      <tr style={{ background: "#f7f7fb" }}>
                        <th style={{ padding: "5px 8px", textAlign: "left", color: "#aaa", fontWeight: 600, width: 70 }}></th>
                        <th style={{ padding: "5px 10px", textAlign: "right", color: "#555", fontWeight: 700 }}>In Library</th>
                        <th style={{ padding: "5px 10px", textAlign: "right", color: "#555", fontWeight: 700 }}>Imported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MACRO_ROWS.map(({ key, label, unit }) => {
                        const existVal = Number(existing?.[key] || 0);
                        const importVal = Number(f[key] || 0);
                        const differs = existVal !== importVal;
                        return (
                          <tr key={key} style={{ borderTop: "1px solid #f5f5f5", background: differs ? "#fffbf0" : undefined }}>
                            <td style={{ padding: "5px 8px", color: "#888", fontSize: 11, fontWeight: differs ? 600 : 400 }}>{label}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", color: "#333" }}>
                              {existVal || "—"}{existVal ? ` ${unit}` : ""}
                            </td>
                            <td style={{ padding: "5px 10px", textAlign: "right", color: differs ? "#f0a500" : "#333", fontWeight: differs ? 700 : 400 }}>
                              {importVal || "—"}{importVal ? ` ${unit}` : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { val: "skip",    label: "Keep original"         },
                      { val: "replace", label: "Replace with imported" },
                      { val: "both",    label: "Keep both"             },
                    ].map(opt => (
                      <button key={opt.val}
                        onClick={() => setDupeRes(r => ({ ...r, [f.name]: opt.val }))}
                        style={{
                          padding: "5px 12px", fontSize: 12, fontWeight: 600,
                          border: res === opt.val ? "1.5px solid #ff8c42" : "1.5px solid #e0e0e0",
                          borderRadius: 8, cursor: "pointer",
                          background: res === opt.val ? "#fff5ee" : "#fafafa",
                          color: res === opt.val ? "#ff8c42" : "#555",
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {res === "both" && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>Imported food will be saved as:</label>
                      <input
                        value={dupeRenames[f.name] ?? f.name + " (imported)"}
                        onChange={e => setDupeRenames(r => ({ ...r, [f.name]: e.target.value }))}
                        onFocus={e => e.target.select()}
                        style={{ ...inp, marginTop: 4, fontSize: 13 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setStep("preview"); setError(""); }} style={sBtn}>← Back</button>
            <button
              onClick={() => runImport(cleanFoods, dupes, dupeRes, dupeRenames)}
              style={{ ...pBtn, flex: 1 }}
            >
              Confirm & Import →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── IMPORTING / DONE STEP
  return (
    <div style={overlay}>
      <div style={{ ...modal, textAlign: "center" }}>
        {importing ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 700 }}>Importing…</h2>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Adding foods to your library</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 700 }}>Import Complete</h2>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "16px 0" }}>
              {[
                { n: importResult?.added,    label: "Added",    color: "#5cb85c" },
                { n: importResult?.replaced, label: "Replaced", color: "#4f8ef7" },
                { n: importResult?.skipped,  label: "Skipped",  color: "#aaa"    },
              ].map(({ n, label, color }) => (
                <div key={label} style={{ background: "#f7f7fb", borderRadius: 10, padding: "12px 18px", minWidth: 70 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{n ?? 0}</div>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ ...pBtn, minWidth: 120 }}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}
