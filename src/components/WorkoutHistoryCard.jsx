import { useState } from "react";

export default function WorkoutHistoryCard({ session, onDelete }) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <div className="bg-white rounded-xl px-3 py-2 mb-2.5 shadow-sm flex items-center justify-between gap-3">
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
                        <span className="font-bold text-[18px]">
                            {session.name}
                        </span>
                        <span className="ml-auto" style={{ fontSize: 12, color: "#aaa" }}>
                            {open ? "▲" : "▼"}
                        </span>
                    </button>
                    <div className="text-xs text-[#aaa] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis px-5">
                        {session.exercises.length} exercise
                        {session.exercises.length !== 1 ? "s" : ""}:{" "}
                        {session.exercises.map((e) => e.name).join(", ")}
                    </div>
                </div>
                <div className="gap-2 shrink-0">

                    <button
                        onClick={() => onDelete(session.id)}
                        className="bg-transparent border-0 cursor-pointer text-[#ccc] text-base px-1.5 py-1"
                        title="Delete routine"
                    >
                        ✕
                    </button>
                </div>
            </div>
            
        </div>
    )
};

