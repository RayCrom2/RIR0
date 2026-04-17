import { useState, useEffect } from "react";

let exerciseDataCache = null;
async function loadExerciseData() {
    if (exerciseDataCache) return exerciseDataCache;
    try {
        const pages = await Promise.all(
            [0, 100, 200, 300, 400, 500, 600, 700, 800].map((offset) =>
                fetch(`https://wger.de/api/v2/exerciseinfo/?format=json&limit=100&offset=${offset}`)
                    .then((r) => r.json())
            )
        );
        const imageMap = {};
        const seen = new Set();
        for (const json of pages) {
            for (const e of (json.results || [])) {
                const name = (e.translations || []).find((t) => t.language === 2)?.name;
                if (!name || seen.has(name)) continue;
                seen.add(name);
                const img = (e.images || []).find((i) => i.is_main) || e.images?.[0];
                imageMap[name.toLowerCase()] = img ? `https://wger.de${img.image}` : null;
            }
        }
        exerciseDataCache = { imageMap };
        return exerciseDataCache;
    } catch {
        return { imageMap: {} };
    }
}

async function fetchWgerImage(exerciseName) {
    const { imageMap } = await loadExerciseData();
    return imageMap[exerciseName.toLowerCase()] ?? null;
}

export default function WorkoutHistoryCard({ session, onDelete }) {
    const [open, setOpen] = useState(false);
    const [images, setImages] = useState({});

    useEffect(() => {
        if (!open) return;
        session.exercises.forEach(async (e) => {
            if (e.name in images) return;
            const url = await fetchWgerImage(e.name);
            if (url) setImages(prev => ({ ...prev, [e.name]: url }));
        });
    }, [open]);

    return (
        <div className="bg-white rounded-xl px-3 py-2 mb-2.5 shadow-sm">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <button
                        onClick={() => setOpen(prev => !prev)}
                        style={{
                            width: "100%",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#333",
                        }}
                    >
                        <span className="font-bold text-[18px]">{session.name}</span>
                        {session.completed_at && (
                            <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: "auto", paddingRight: 12 }}>
                                {new Date(session.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                        )}
                        <span style={{ fontSize: 12, color: "#aaa" }}>{open ? "▲" : "▼"}</span>
                    </button>
                    {open ? null :
                        <div className="text-xs text-[#aaa] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis px-5">
                            {session.exercises.length} exercise{session.exercises.length !== 1 ? "s" : ""}:{" "}
                            {session.exercises.map((e) => e.name).join(", ")}
                        </div>
                    }
                </div>
                <div className="shrink-0">
                    <button
                        onClick={() => onDelete(session.id)}
                        className="bg-transparent border-0 cursor-pointer text-[#ccc] text-base px-1.5 py-1"
                        title="Delete workout"
                    >✕</button>
                </div>
            </div>

            {/* Expanded content */}
            {open && (
                <div className="px-3 pb-3 pt-1">
                    {session.exercises.map((e, exIndex) => (
                        <div key={e.name} className="mb-3 rounded-lg px-2 py-1" style={{ background: exIndex % 2 === 0 ? '#f0f4ff' : '#fff8f3' }}>
                            <div className="flex items-center gap-3 mb-1">
                                {images[e.name] && (
                                    <img
                                        src={images[e.name]}
                                        alt={e.name}
                                        style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 6, background: '#fff', flexShrink: 0 }}
                                    />
                                )}
                                <div className="font-semibold text-[13px] text-[#333]">{e.name}</div>
                            </div>
                            <div className="grid text-[12px] text-[#aaa] font-semibold mb-1 px-1" style={{ gridTemplateColumns: '24px 1fr 1fr 1fr' }}>
                                <span>#</span>
                                <span>Reps</span>
                                <span>Weight ({e.unit})</span>
                                <span>RIR</span>
                            </div>
                            {e.sets.map((set, index) => (
                                <div key={index} className="grid text-[13px] py-0.5 px-1 rounded" style={{ gridTemplateColumns: '24px 1fr 1fr 1fr', background: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                                    <span className="text-[#aaa]">{index + 1}</span>
                                    <span>{set.reps || '—'}</span>
                                    <span>{set.weight || '—'}</span>
                                    <span>{set.rir != null && set.rir !== '' ? set.rir : '—'}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
