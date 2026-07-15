import React, { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { APP_CONFIG } from "@/constants";

const API = APP_CONFIG.apiUrl;
const METERAI_IMG = "/meterai_10000.png";

export interface StampingCoordinates {
  materai?: { x: number; y: number; rotation?: number };
  ttd?: { x: number; y: number; rotation?: number };
  stamp?: { x: number; y: number; rotation?: number };
}

interface ComponentDim { x: number; y: number; w: number; h: number; }

interface PreviewData {
  image_b64: string;
  orig_w: number; orig_h: number;
  preview_w: number; preview_h: number;
  scale: number;
  default_coords: { materai: ComponentDim; ttd: ComponentDim; stamp: ComponentDim; };
  nominal: number;
}

export interface DraggableStampingPreviewProps {
  loanId: string;
  nominal: number;
  authToken: string;
  stampApplied: boolean;
  signatureB64?: string;
  onCoordinatesChange: (coords: StampingCoordinates) => void;
  stampColor?: string;
  stampName?: string;
}

type ComponentKey = "materai" | "ttd" | "stamp";

/**
 * Preview Stamp Modal — renders as a 🔍 trigger button.
 * Opens a full-screen modal where admin can drag TTD, Cap, Materai.
 *
 * Flow:
 *  1. On mount (or when inputs change), calls POST /api/kasbon/preview-stamp
 *     to get a base64 JPEG preview + component default positions.
 *  2. Renders the preview image as the background.
 *  3. Renders each active component (materai/ttd/stamp) as a draggable overlay.
 *  4. On drag, converts screen px → original-canvas px using the server-supplied
 *     `scale` factor, then fires `onCoordinatesChange` so the parent has final coords.
 *
 * Coordinate Scaling:
 *   origX = previewX / scale
 *   origY = previewY / scale
 *
 * Opens a full-screen modal where admin can drag TTD, Cap, Materai.
 * Coordinate: origX = previewPx / scale (scale = preview_w / orig_w from server).
 */
export const DraggableStampingPreview: React.FC<DraggableStampingPreviewProps> = ({
  loanId,
  nominal,
  authToken,
  stampApplied,
  signatureB64,
  onCoordinatesChange,
  stampColor = "red",
  stampName = "KOPERASI MITRA SEJAHTERA",
}) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<ComponentKey | null>(null);
  const previewRef = useRef<PreviewData | null>(null);
  const rotationsRef = useRef<Record<ComponentKey, number>>({ materai: 0, ttd: 0, stamp: 0 });
  previewRef.current = preview;

  const [positions, setPositions] = useState<Record<ComponentKey, { x: number; y: number }>>({
    materai: { x: 0, y: 0 },
    ttd: { x: 0, y: 0 },
    stamp: { x: 0, y: 0 },
  });
  // Rotation state in degrees (clockwise) per component
  const [rotations, setRotations] = useState<Record<ComponentKey, number>>({
    materai: 0, ttd: 0, stamp: 0,
  });

  // ── Fetch preview ─────────────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/kasbon/preview-stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          loan_id: loanId,
          admin_signature: signatureB64 ?? null,
          stamp_applied: stampApplied,
          stamp_color: stampColor,
          stamp_name: stampName,
          coords: null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
      const data: PreviewData = await res.json();
      setPreview(data);
      const s = data.scale;
      setPositions({
        materai: { x: data.default_coords.materai.x * s, y: data.default_coords.materai.y * s },
        ttd:     { x: data.default_coords.ttd.x * s,     y: data.default_coords.ttd.y * s },
        stamp:   { x: data.default_coords.stamp.x * s,   y: data.default_coords.stamp.y * s },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat preview");
    } finally {
      setLoading(false);
    }
  }, [loanId, authToken, stampApplied, signatureB64, stampColor, stampName]);

  useEffect(() => { if (open && !preview) fetchPreview(); }, [open, preview, fetchPreview]);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent, key: ComponentKey) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = key;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSaved(false);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const key = draggingRef.current;
    if (!key || !containerRef.current || !previewRef.current) return;
    const data = previewRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const rx = rect.width / data.preview_w;
    const ry = rect.height / data.preview_h;
    const px = (e.clientX - rect.left) / rx;
    const py = (e.clientY - rect.top) / ry;
    const dim = data.default_coords[key];
    const cx = Math.max(0, Math.min(px, data.preview_w - dim.w * data.scale));
    const cy = Math.max(0, Math.min(py, data.preview_h - dim.h * data.scale));

    setPositions((prev) => {
      const next = { ...prev, [key]: { x: cx, y: cy } };
      const s = data.scale;
      // rotations accessed via ref to avoid stale closure
      const rots = rotationsRef.current;
      const coords: StampingCoordinates = {
        ttd:   { x: next.ttd.x / s,   y: next.ttd.y / s,   rotation: rots.ttd },
        stamp: { x: next.stamp.x / s, y: next.stamp.y / s, rotation: rots.stamp },
      };
      if (data.nominal >= 1000000) coords.materai = { x: next.materai.x / s, y: next.materai.y / s, rotation: rots.materai };
      onCoordinatesChange(coords);
      return next;
    });
  }, [onCoordinatesChange]);

  const onPointerUp = useCallback(() => { draggingRef.current = null; }, []);

  // ── Overlay style ─────────────────────────────────────────────────────────
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const ro = new ResizeObserver(() => tick((n) => n + 1));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [open]);

  const overlayStyle = (key: ComponentKey): React.CSSProperties => {
    if (!preview || !containerRef.current) return { display: "none" };
    const data = preview;
    const rect = containerRef.current.getBoundingClientRect();
    const rx = rect.width / data.preview_w;
    const ry = rect.height / data.preview_h;
    const dim = data.default_coords[key];
    return {
      position: "absolute",
      left: positions[key].x * rx,
      top: positions[key].y * ry,
      width: dim.w * data.scale * rx,
      height: dim.h * data.scale * ry,
      cursor: "grab",
      touchAksi: "none",
      userSelect: "none",
    };
  };

  const handleReset = () => {
    if (!preview) return;
    const s = preview.scale;
    const zeroRots = { materai: 0, ttd: 0, stamp: 0 };
    setPositions({
      materai: { x: preview.default_coords.materai.x * s, y: preview.default_coords.materai.y * s },
      ttd:     { x: preview.default_coords.ttd.x * s,     y: preview.default_coords.ttd.y * s },
      stamp:   { x: preview.default_coords.stamp.x * s,   y: preview.default_coords.stamp.y * s },
    });
    setRotations(zeroRots);
    rotationsRef.current = zeroRots;
    onCoordinatesChange({
      ttd:   { x: preview.default_coords.ttd.x,   y: preview.default_coords.ttd.y,   rotation: 0 },
      stamp: { x: preview.default_coords.stamp.x, y: preview.default_coords.stamp.y, rotation: 0 },
      ...(preview.nominal >= 1000000 ? { materai: { x: preview.default_coords.materai.x, y: preview.default_coords.materai.y, rotation: 0 } } : {}),
    });
  };

  const handleRotationChange = useCallback((key: ComponentKey, deg: number) => {
    setSaved(false);
    setRotations((prev) => {
      const next = { ...prev, [key]: deg };
      rotationsRef.current = next;
      if (preview) {
        const s = preview.scale;
        const coords: StampingCoordinates = {
          ttd:   { x: positions.ttd.x / s,   y: positions.ttd.y / s,   rotation: next.ttd },
          stamp: { x: positions.stamp.x / s, y: positions.stamp.y / s, rotation: next.stamp },
        };
        if (preview.nominal >= 1000000) coords.materai = { x: positions.materai.x / s, y: positions.materai.y / s, rotation: next.materai };
        onCoordinatesChange(coords);
      }
      return next;
    });
  }, [preview, positions, onCoordinatesChange]);

  // ── Trigger button ────────────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400 transition-all"
        title="Buka preview posisi stamp"
      >
        {/* Magnifier + Plus icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        {saved ? "✓ Posisi Disimpan" : "Preview Posisi Stamp"}
      </button>

      {/* ── Full-screen modal via portal ── */}
      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ backgroundColor: "rgba(0,0,0,0.88)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-white/10 flex-shrink-0 gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span className="text-sm font-semibold text-white truncate">Preview &amp; Atur Posisi Stamp</span>
              <span className="text-[10px] text-gray-400 hidden md:inline flex-shrink-0">— seret komponen untuk menyesuaikan posisi</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={fetchPreview} disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded border border-white/20 text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-40">
                {loading ? "⏳" : "🔄 Refresh"}
              </button>
              <button onClick={handleReset} disabled={!preview}
                className="text-[11px] px-2.5 py-1 rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-40">
                ↩ Default
              </button>
              <button onClick={() => { setSaved(true); setOpen(false); }}
                className="text-[11px] px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors">
                ✓ Simpan
              </button>
              <button onClick={() => setOpen(false)} aria-label="Tutup"
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-xl leading-none">
                ×
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/80 border-b border-white/5 flex-shrink-0 flex-wrap text-[11px] text-gray-300">
            {/* Materai legend disabled */}
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-dashed border-blue-400 bg-blue-100/20 rounded-sm"/>TTD
            </span>
            {stampApplied && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-dashed border-indigo-400 bg-indigo-100/20 rounded-full"/>Cap
              </span>
            )}
            {preview && (
              <span className="ml-auto text-[10px] text-gray-500 hidden sm:inline">
                {preview.orig_w}×{preview.orig_h}px · scale {preview.scale.toFixed(4)}
              </span>
            )}
          </div>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-3 sm:p-6">
            {loading && !preview && (
              <div className="flex flex-col items-center gap-3 text-gray-400 mt-20">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
                <span className="text-sm">Memuat preview dokumen...</span>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center gap-3 mt-20 text-center px-4">
                <span className="text-3xl">⚠️</span>
                <p className="text-red-400 font-semibold text-sm">{error}</p>
                <button onClick={fetchPreview}
                  className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors">
                  Coba Lagi
                </button>
              </div>
            )}
            {preview && (
              <div
                ref={containerRef}
                className="relative select-none"
                style={{ width: "100%", maxWidth: preview.preview_w, aspectRatio: `${preview.preview_w} / ${preview.preview_h}`, touchAksi: "none" }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerBatal={onPointerUp}
              >
                <img
                  src={`data:image/jpeg;base64,${preview.image_b64}`}
                  alt="Document preview"
                  className="w-full h-full object-contain rounded shadow-xl pointer-events-none"
                  draggable={false}
                />
                {/* Materai overlay disabled */}
                <div onPointerDown={(e) => onPointerDown(e, "ttd")} style={overlayStyle("ttd")}
                  className="border-2 border-dashed border-blue-400 bg-blue-300/20 hover:bg-blue-300/35 flex items-center justify-center z-20 transition-colors"
                  title="Geser: Tanda Tangan">
                  <span className="text-[9px] sm:text-[11px] text-blue-200 font-bold pointer-events-none drop-shadow">✍️ TTD</span>
                </div>
                {stampApplied && (
                  <div onPointerDown={(e) => onPointerDown(e, "stamp")} style={{ ...overlayStyle("stamp"), borderRadius: "50%" }}
                    className="border-2 border-dashed border-indigo-400 bg-indigo-300/20 hover:bg-indigo-300/35 flex items-center justify-center z-30 transition-colors"
                    title="Geser: Cap Perusahaan">
                    <span className="text-[9px] sm:text-[11px] text-indigo-200 font-bold pointer-events-none drop-shadow">🏛 CAP</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rotation controls disabled (materai nonaktif) */}
          {false && preview && preview.nominal >= 1000000 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/80 border-t border-white/10 flex-shrink-0">
              <span className="text-[11px] text-pink-300 font-semibold whitespace-nowrap">↻ Meterai</span>
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handleRotationChange("materai", ((rotations.materai - 15) + 360) % 360); }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-pink-400/50 bg-pink-500/10 text-pink-300 text-lg font-bold hover:bg-pink-500/20 active:scale-95"
                title="-15°"
              >−</button>
              <input
                type="range"
                min={0} max={359} step={1}
                value={rotations.materai}
                onChange={(e) => handleRotationChange("materai", Number(e.target.value))}
                className="flex-1 h-2 accent-pink-400 cursor-pointer"
                style={{ touchAksi: "none" }}
              />
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handleRotationChange("materai", (rotations.materai + 15) % 360); }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-pink-400/50 bg-pink-500/10 text-pink-300 text-lg font-bold hover:bg-pink-500/20 active:scale-95"
                title="+15°"
              >+</button>
              <span className="text-[11px] text-pink-300 font-mono w-10 text-right">{rotations.materai}°</span>
            </div>
          )}

          {/* Mobile bottom bar */}
          <div className="flex sm:hidden items-center gap-2 px-4 py-3 bg-gray-900 border-t border-white/10 flex-shrink-0">
            <button onClick={() => setOpen(false)}
              className="flex-1 py-2 rounded-lg border border-white/20 text-gray-300 text-sm font-semibold">
              Batal
            </button>
            <button onClick={() => { setSaved(true); setOpen(false); }}
              className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
              ✓ Simpan Posisi
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default DraggableStampingPreview;
