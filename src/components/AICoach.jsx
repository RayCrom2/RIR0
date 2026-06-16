import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { gatherCoachData, fetchLoggedDaySummaries } from "../lib/aiCoachData";

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const FOLLOW_UP_LIMIT = 3;
const PROFILE_INFO_MESSAGE =
  "I'll be here whenever you need me — you can find me anytime at the bottom of your Profile page. Feel free to ask a few more questions about your plan before we wrap up.";

function appendRecommendations(reply, priorMessages) {
  const content = reply.replace("[RECOMMENDATIONS]", "").trim();
  return [
    ...priorMessages,
    { role: "assistant", content, isRecommendation: true },
    { role: "assistant", content: PROFILE_INFO_MESSAGE },
  ];
}

export default function AICoach({ open, onClose, goals, userId }) {
  const [phase, setPhase] = useState("setup");
  const [loggedDays, setLoggedDays] = useState([]);
  const [excludedDates, setExcludedDates] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);
  const [followUpCount, setFollowUpCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setPhase("setup");
      setLoggedDays([]);
      setExcludedDates(new Set());
      setMessages([]);
      setInputValue("");
      setLoading(false);
      setUserData(null);
      setError(null);
      setFollowUpCount(0);
      return;
    }
    fetchLoggedDaySummaries(userId).then(setLoggedDays);
  }, [open, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  function toggleExclude(date) {
    setExcludedDates((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  async function callCoach(msgs, data) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: msgs, userData: data }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("[AICoach] edge function error:", body);
      throw new Error(body.error || `Edge function error: ${res.status}`);
    }
    const json = await res.json();
    return json.message;
  }

  async function handleStart() {
    setPhase("loading");
    setError(null);
    try {
      const data = await gatherCoachData(userId, goals, [...excludedDates]);
      setUserData(data);
      const reply = await callCoach([{ role: "user", content: "Please analyze my data and start with your first question." }], data);
      const isComplete = reply.startsWith("[RECOMMENDATIONS]");
      if (isComplete) {
        setMessages(appendRecommendations(reply, []));
        setPhase("complete");
      } else {
        setMessages([{ role: "assistant", content: reply }]);
        setPhase("questioning");
      }
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  }

  async function handleSubmit() {
    if (!inputValue.trim() || loading) return;
    const isFollowUp = phase === "complete";
    if (isFollowUp && followUpCount >= FOLLOW_UP_LIMIT) return;

    const userMsg = { role: "user", content: inputValue.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputValue("");
    setLoading(true);
    setError(null);
    try {
      const reply = await callCoach(nextMessages, userData);
      if (isFollowUp) {
        setMessages([...nextMessages, { role: "assistant", content: reply }]);
        setFollowUpCount((c) => c + 1);
      } else {
        const isComplete = reply.startsWith("[RECOMMENDATIONS]");
        if (isComplete) {
          setMessages(appendRecommendations(reply, nextMessages));
          setPhase("complete");
        } else {
          setMessages([...nextMessages, { role: "assistant", content: reply }]);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
          <span style={{ fontSize: 20, marginRight: 10 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>AI Nutrition Coach</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}>✕</button>
        </div>

        {/* Setup phase */}
        {phase === "setup" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 8px", flexShrink: 0 }}>
              <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: "#333" }}>Review your logged days</p>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                Toggle off any days you didn't log completely — they'll be excluded from the analysis.
              </p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
              {loggedDays.length === 0 ? (
                <p style={{ color: "#bbb", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No logged days found in the last 14 days.</p>
              ) : (
                loggedDays.map((day) => {
                  const excluded = excludedDates.has(day.date);
                  const goalCalories = goals?.calories;
                  const offGoal = goalCalories && (day.totalCalories < 0.75 * goalCalories || day.totalCalories > 1.25 * goalCalories);
                  return (
                    <div
                      key={day.date}
                      onClick={() => toggleExclude(day.date)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 6, background: excluded ? "#fafafa" : "#f7f7fb", border: `1px solid ${offGoal && !excluded ? "#e05c5c" : excluded ? "#e0e0e0" : "#e8e8e8"}`, cursor: "pointer", opacity: excluded ? 0.5 : 1 }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${excluded ? "#ccc" : "#ff8c42"}`, background: excluded ? "#fff" : "#ff8c42", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {!excluded && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: excluded ? "#bbb" : "#333" }}>{formatDate(day.date)}</span>
                      {offGoal && (
                        <span title="Is this information correct?" style={{ fontSize: 14, cursor: "help" }}>⚠️</span>
                      )}
                      <span style={{ fontSize: 13, color: excluded ? "#bbb" : "#ff8c42", fontWeight: 600 }}>{day.totalCalories} kcal</span>
                      <span style={{ fontSize: 11, color: "#bbb" }}>{day.entries} {day.entries === 1 ? "entry" : "entries"}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ padding: "12px 20px 20px", flexShrink: 0, borderTop: "1px solid #f0f0f0" }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#bbb" }}>
                {loggedDays.length - excludedDates.size} of {loggedDays.length} days included
              </p>
              <button
                onClick={handleStart}
                disabled={loggedDays.length === 0}
                style={{ width: "100%", padding: "12px 0", border: "none", borderRadius: 10, background: "#ff8c42", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loggedDays.length === 0 ? "default" : "pointer", opacity: loggedDays.length === 0 ? 0.5 : 1 }}
              >
                Start Analysis
              </button>
            </div>
          </div>
        )}

        {/* Loading phase */}
        {phase === "loading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32 }}>
            <div className="auth-spinner" />
            <p style={{ margin: 0, fontSize: 14, color: "#aaa" }}>Gathering your data and preparing your coach…</p>
          </div>
        )}

        {/* Error phase */}
        {phase === "error" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#e05c5c" }}>Something went wrong. {error}</p>
            <button
              onClick={() => { setPhase("setup"); setError(null); }}
              style={{ padding: "9px 22px", border: "none", borderRadius: 8, background: "#ff8c42", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Questioning / complete phase */}
        {(phase === "questioning" || phase === "complete") && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                if (msg.isRecommendation) {
                  return (
                    <div key={i} style={{ background: "#f0f9f0", border: "1px solid #5cb85c", borderRadius: 12, padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#5cb85c", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommendations</p>
                      <p style={{ margin: 0, fontSize: 14, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 12, background: isUser ? "#ff8c42" : "#f7f7fb", color: isUser ? "#fff" : "#333", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "10px 14px", borderRadius: 12, background: "#f7f7fb" }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#bbb", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {(phase === "questioning" || (phase === "complete" && followUpCount < FOLLOW_UP_LIMIT)) && (
              <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    placeholder={phase === "complete" ? "Ask a follow-up question…" : "Type your answer…"}
                    rows={2}
                    style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!inputValue.trim() || loading}
                    style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: inputValue.trim() && !loading ? "#ff8c42" : "#f0f0f0", color: inputValue.trim() && !loading ? "#fff" : "#bbb", fontWeight: 700, fontSize: 14, cursor: inputValue.trim() && !loading ? "pointer" : "default", flexShrink: 0 }}
                  >
                    Send
                  </button>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#bbb" }}>
                  {phase === "complete"
                    ? `${FOLLOW_UP_LIMIT - followUpCount} question${FOLLOW_UP_LIMIT - followUpCount === 1 ? "" : "s"} left this session · Enter to send`
                    : "Enter to send · Shift+Enter for new line"}
                </p>
              </div>
            )}
            {phase === "complete" && followUpCount >= FOLLOW_UP_LIMIT && (
              <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#bbb", textAlign: "center" }}>
                  You've used all your questions for this session — see you in your Profile next time!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
