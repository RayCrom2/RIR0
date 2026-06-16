export default function AICoachPrompt({ open, onTrack, onStart, onDismiss }) {
  if (!open) return null;

  const headline =
    onTrack === false
      ? "Your weight isn't tracking toward your goal yet."
      : "You're making great progress! 🎉";
  const body =
    onTrack === false
      ? "Let's figure out what to adjust — I can help."
      : "Keep it up! Want to review your progress or ask a question?";
  const cta = onTrack === false ? "Get Help" : "Review Progress";

  return (
    <>
      <div className="ai-coach-prompt-backdrop" onClick={onDismiss} />
      <div className="ai-coach-prompt">
        <div style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", padding: "18px 20px", width: "100%" }}>
          <button
            onClick={onDismiss}
            style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#bbb", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 6 }}
          >
            ✕
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>🤖</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: "#333" }}>{headline}</p>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#777", lineHeight: 1.5 }}>{body}</p>
              <button
                onClick={onStart}
                style={{ background: "#ff8c42", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
