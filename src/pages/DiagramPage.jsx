import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import HumanDiagram from "../components/HumanDiagram";
import HumanDiagramBack from "../components/HumanDiagramBack";
import HumanDiagramFemaleFront from "../components/HumanDiagramFemaleFront";
import HumanDiagramFemaleBack from "../components/HumanDiagramFemaleBack";
import muscles from "../data/muscles";

export default function DiagramPage() {
  const [selected, setSelected] = useState(null);
  const [activePart, setActivePart] = useState(null);
  const [diagramView, setDiagramView] = useState("front");
  const [assistantActive, setAssistantActive] = useState(false);
  const diagramRef = useRef(null);
  const navigate = useNavigate();

  const extractSlug = (val) => {
    if (typeof val === "string") return val;

    if (val && typeof val === "object") {
      if (val.slug || val.name || val.id || val.key) {
        return val.slug || val.name || val.id || val.key;
      }
      const t = val.target || val.currentTarget;
      if (t) {
        const el = t.closest ? t.closest("[data-muscle], [aria-label]") : t;
        const byData =
          el?.dataset?.muscle ??
          el?.getAttribute?.("data-muscle") ??
          t?.dataset?.muscle ??
          t?.getAttribute?.("data-muscle");
        const byAria =
          el?.getAttribute?.("aria-label") ?? t?.getAttribute?.("aria-label");
        if (byData) return byData;
        if (byAria) return byAria;

        const id = el?.id || t?.id;
        if (id && /[a-z]+(\.(left|right))?$/i.test(id)) return id;
      }
    }

    return null;
  };

  const normalizeForDisplay = (slug) => {
    if (!slug) return null;
    const base = slug.replace(/\.(left|right)$/i, "");
    return base.charAt(0).toUpperCase() + base.slice(1);
  };

  useEffect(() => {
    const root = diagramRef.current;
    if (!root) return;

    const onClickCapture = (e) => {
      // ignore clicks on the info panel
      if (e.target.closest('.info-panel')) return;
      const slug = extractSlug(e);
      if (slug) setSelected(slug);
      else setSelected(null);
    };

    const onCustom = (e) => {
      const slug = e?.detail?.slug || extractSlug(e);
      if (slug) setSelected(slug);
    };

    root.addEventListener("click", onClickCapture, true);
    window.addEventListener("muscle-select", onCustom);

    return () => {
      root.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("muscle-select", onCustom);
    };
  }, []);

  const displayName = useMemo(() => normalizeForDisplay(selected), [selected]);

  const displayInfo = useMemo(() => {
    if (!selected) return null;
    const base = selected.replace(/\.(left|right)$/i, "");
    return muscles[base] || null;
  }, [selected]);

  useEffect(() => {
    setActivePart(null);
  }, [selected]);

  const handleClick = () => {
    console.log(assistantActive);
  };

  return (
    <>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setDiagramView("front")}
          className={
            diagramView === "front"
              ? "px-3 py-1.5 rounded-full border cursor-pointer bg-[#ff8c42] text-white border-[#ff8c42]"
              : "px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-900 cursor-pointer"
          }
        >
          Front (Male)
        </button>
        <button
          type="button"
          onClick={() => setDiagramView("back")}
          className={
            diagramView === "back"
              ? "px-3 py-1.5 rounded-full border cursor-pointer bg-[#ff8c42] text-white border-[#ff8c42]"
              : "px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-900 cursor-pointer"
          }
        >
          Back (Male)
        </button>
        <button
          type="button"
          onClick={() => setDiagramView("front2")}
          className={
            diagramView === "front2"
              ? "px-3 py-1.5 rounded-full border cursor-pointer bg-[#ff8c42] text-white border-[#ff8c42]"
              : "px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-900 cursor-pointer"
          }
        >
          Front (Female)
        </button>
        <button
          type="button"
          onClick={() => setDiagramView("back2")}
          className={
            diagramView === "back2"
              ? "px-3 py-1.5 rounded-full border cursor-pointer bg-[#ff8c42] text-white border-[#ff8c42]"
              : "px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-900 cursor-pointer"
          }
        >
          Back (Female)
        </button>
      </div>

      <div className="flex gap-5" ref={diagramRef}>
        <div className="shrink-0 self-start">
          {diagramView === "front" ? (
            <HumanDiagram
              selectedSlugs={selected ? [selected] : []}
              selectedSubpart={
                selected && activePart ? `${selected}.${activePart}` : selected
              }
            />
          ) : diagramView === "back" ? (
            <HumanDiagramBack selectedSlugs={selected ? [selected] : []} />
          ) : diagramView === "front2" ? (
            <HumanDiagramFemaleFront
              selectedSlugs={selected ? [selected] : []}
            />
          ) : (
            <HumanDiagramFemaleBack
              selectedSlugs={selected ? [selected] : []}
            />
          )}
        </div>

        <div className="sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="info-panel bg-white p-3 rounded-lg flex-1 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <h2>
              <strong>{displayName}</strong>
            </h2>
            {displayInfo ? (
              <>
                <p>{displayInfo.description}</p>
                {displayInfo.tips ? (
                  <p>
                    <strong>Tips:</strong> {displayInfo.tips}
                  </p>
                ) : null}
                {displayInfo.parts && displayInfo.parts.length ? (
                  <div className="mt-2">
                    <p>
                      <strong>Parts</strong>
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {displayInfo.parts.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => setActivePart(p.key)}
                          className={
                            activePart === p.key
                              ? "px-2.5 py-1.5 rounded-md border-2 border-[#ff8c42] bg-[#ff8c42] text-white cursor-pointer"
                              : "px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 cursor-pointer"
                          }
                        >
                          {p.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setActivePart(null)}
                        className="px-2.5 py-1.5 rounded-md border border-gray-300 bg-white cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}

                {activePart ? (
                  (() => {
                    const part = displayInfo.parts?.find(
                      (pp) => pp.key === activePart,
                    );
                    if (!part) return null;
                    return (
                      <div className="mt-2.5">
                        <p>{part.description}</p>
                        {part.tips ? (
                          <p>
                            <strong>Tips:</strong> {part.tips}
                          </p>
                        ) : null}
                        {part.exercises && part.exercises.length ? (
                          <>
                            <p>
                              <strong>Exercises</strong>
                            </p>
                            <ul>
                              {part.exercises.map((ex) => (
                                <li key={ex}>
                                  <a
                                    href="#"
                                    className="text-blue-600 underline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      navigate(
                                        `/videos?exercise=${encodeURIComponent(ex)}`,
                                      );
                                    }}
                                  >
                                    {ex}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                    );
                  })()
                ) : displayInfo.exercises && displayInfo.exercises.length ? (
                  <>
                    <p>
                      <strong>Exercises</strong>
                    </p>
                    <ul>
                      {displayInfo.exercises.map((ex) => (
                        <li key={ex}>
                          <a
                            href="#"
                            className="text-blue-600 underline"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(
                                `/videos?exercise=${encodeURIComponent(ex)}`,
                              );
                            }}
                          >
                            {ex}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {displayInfo.contraindications &&
                displayInfo.contraindications.length ? (
                  <>
                    <p>
                      <strong>Contraindications</strong>
                    </p>
                    <ul>
                      {displayInfo.contraindications.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p>No muscle selected. Click the diagram to get started.</p>
            )}
          </div>
          <div
            className="mt-2" /*{className="bg-green-200 p-2 rounded-lg mt-1 flex-1 shadow-[0_6px_18px_rgba(0,0,0,0.06)]"}*/
          >
            {assistantActive ? (
              <div className="flex">
                <p>Hi</p>
                <button
                  className="w-auto ml-auto text-center px-2 py-1 rounded-lg cursor-pointer border-2 border-[#ff8c42] text-[#ff8c42] font-semibold hover:bg-[#ff8c42] hover:text-white"
                  onClick={() => setAssistantActive(!assistantActive)}
                >
                  Exit AI Mode
                </button>
              </div>
            ) : (
              <button
                className="w-full  text-left pl-4 py-2 rounded-lg cursor-pointer border-2 border-[#ff8c42] text-[#ff8c42] font-semibold hover:bg-[#ff8c42] hover:text-white"
                onClick={() => setAssistantActive(!assistantActive)}
              >
                Ask AI Assistant
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
