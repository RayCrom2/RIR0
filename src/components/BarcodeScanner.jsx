import { useEffect, useRef, useState } from "react";

const BARCODE_FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e",
  "code_128", "code_39", "itf", "data_matrix", "qr_code",
];

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let rafId = null;
    let zxingControls = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

        if ("BarcodeDetector" in window) {
          // Native path: Chrome, Edge, Android Chrome
          let supported = BARCODE_FORMATS;
          try { supported = await BarcodeDetector.getSupportedFormats(); } catch {}
          const formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
          const detector = new BarcodeDetector({ formats: formats.length ? formats : BARCODE_FORMATS });

          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);

          const scan = async () => {
            if (stopped) return;
            try {
              if (videoRef.current?.readyState >= 2) {
                const results = await detector.detect(videoRef.current);
                if (results.length > 0) {
                  stopped = true;
                  onScan(results[0].rawValue);
                  return;
                }
              }
            } catch {}
            rafId = requestAnimationFrame(scan);
          };
          rafId = requestAnimationFrame(scan);
        } else {
          // ZXing fallback: Safari, Firefox
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromStream(
            stream,
            videoRef.current,
            (result, _err, controls) => {
              if (stopped) return;
              if (result) {
                stopped = true;
                controls?.stop();
                onScan(result.getText());
              }
            }
          );
          setScanning(true);
        }
      } catch (err) {
        if (!stopped)
          setError(
            err.name === "NotAllowedError"
              ? "Camera permission denied. Please allow camera access and try again."
              : "Could not access the camera. Make sure no other app is using it."
          );
      }
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      zxingControls?.stop();
    };
  }, [onScan]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>Scan Barcode</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>✕</button>
        </div>

        {error ? (
          <div style={{ color: "#e05c5c", fontSize: 14, padding: "24px 0", textAlign: "center", lineHeight: 1.6 }}>{error}</div>
        ) : (
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#111", aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {/* Viewfinder */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ position: "relative", width: "72%", aspectRatio: "2/1", boxShadow: "0 0 0 9999px rgba(0,0,0,0.48)", borderRadius: 10 }}>
                {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v, h]) => (
                  <div key={v+h} style={{
                    position: "absolute",
                    width: 22, height: 22,
                    [v]: -2, [h]: -2,
                    borderStyle: "solid",
                    borderColor: "#ff8c42",
                    borderWidth: 0,
                    [`border${v[0].toUpperCase()+v.slice(1)}Width`]: 3,
                    [`border${h[0].toUpperCase()+h.slice(1)}Width`]: 3,
                    [`border${v[0].toUpperCase()+v.slice(1)}${h[0].toUpperCase()+h.slice(1)}Radius`]: 10,
                  }} />
                ))}
              </div>
            </div>
            {/* Starting overlay */}
            {!scanning && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 13 }}>Starting camera…</span>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", margin: "12px 0 0" }}>
          Hold the barcode steady inside the frame
        </p>
      </div>
    </div>
  );
}
