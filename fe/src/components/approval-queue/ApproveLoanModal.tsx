import React, { useRef, useState } from "react";
import { ChevronDown, Shield, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import { fmtRp } from "@/lib/formatters";
import DraggableStampingPreview, { StampingCoordinates } from "../dgtnz/DraggableStampingPreview";
import { LoanRequest, SIG_COLOR_HEX, STAMP_COLOR_HEX, STAMP_COLOR_LABEL } from "./types";
import { toast } from "sonner";

interface ApproveLoanModalProps {
  modalLoan: LoanRequest;
  onClose: () => void;
  onSuccess: () => void;
  authToken: string;
}

export default function ApproveLoanModal({ modalLoan, onClose, onSuccess, authToken }: ApproveLoanModalProps) {
  const [signing, setSigning] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  
  const [stampApplied, setStampApplied] = useState(false);
  const [stampStyle, setStampStyle] = useState<"classic" | "embossed">("classic");
  const [stampColor, setStampColor] = useState<string>("red");
  const [stampName, setStampName] = useState<string>("KOPERASI MITRA SEJAHTERA");
  const [stampColorOpen, setStampColorOpen] = useState(false);
  
  const [signatureColor, setSignatureColor] = useState<string>("black");
  const [sigColorOpen, setSigColorOpen] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [stampingCoords, setStampingCoords] = useState<StampingCoordinates | undefined>();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // ── Canvas helpers ───────────────────────────────────────────────────────────

  const _initCanvas = (canvas: HTMLCanvasElement, color: string = "#111827") => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      canvas,
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const getTouchCanvasPoint = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const touch = e.touches[0] || e.changedTouches[0];
    if (!canvas || !touch) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      canvas,
      x: ((touch.clientX - rect.left) * canvas.width) / rect.width,
      y: ((touch.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return true;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] !== 255 || data[index + 1] !== 255 || data[index + 2] !== 255 || data[index + 3] !== 255) {
        return false;
      }
    }
    return true;
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureEnabled) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    isDrawing.current = true;
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const ctx = point.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.strokeStyle = SIG_COLOR_HEX[signatureColor] ?? "#111827";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureEnabled) return;
    if (!isDrawing.current) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    const ctx = point.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const startDrawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!signatureEnabled) return;
    e.preventDefault();
    const point = getTouchCanvasPoint(e);
    if (!point) return;
    isDrawing.current = true;
    const ctx = point.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.strokeStyle = SIG_COLOR_HEX[signatureColor] ?? "#111827";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!signatureEnabled) return;
    if (!isDrawing.current) return;
    e.preventDefault();
    const point = getTouchCanvasPoint(e);
    if (!point) return;
    const ctx = point.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleApprove = async () => {
    if (!modalLoan || !canvasRef.current) return;
    if (isCanvasBlank(canvasRef.current)) {
      setApproveError("Tanda tangan admin wajib diisi sebelum approval.");
      return;
    }
    const signatureData = canvasRef.current.toDataURL("image/png");
    setSigning(true);
    setApproveError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Login diperlukan.");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/approve-loan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          loan_id: modalLoan.id,
          admin_signature: signatureData,
          stamp_applied: stampApplied,
          stamp_style: stampStyle,
          stamp_color: stampColor,
          stamp_name: stampName,
          coords: stampingCoords,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      toast.success("Pengajuan berhasil disetujui!");
      onSuccess();
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : "Gagal approve.");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl overflow-y-auto max-h-[95vh]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Setujui Pengajuan</h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              {modalLoan.nama_lengkap} – {fmtRp(modalLoan.nominal_pengajuan)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tanda Tangan Digital */}
        <p className="text-sm text-zinc-500 mb-6">Tandatangani di bawah untuk memvalidasi dokumen logistik ini:</p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSignatureEnabled((v) => !v);
              if (!signatureEnabled && canvasRef.current) {
                _initCanvas(canvasRef.current, SIG_COLOR_HEX[signatureColor]);
              }
            }}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
              signatureEnabled ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {signatureEnabled ? "TTD Aktif" : "Aktifkan TTD"}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setSigColorOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-400"
            >
              <span className="w-3 h-3 rounded-full border border-zinc-300/50 flex-shrink-0" style={{ background: SIG_COLOR_HEX[signatureColor] }} />
              <ChevronDown className="h-3 w-3" />
            </button>
            {sigColorOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 flex flex-col rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden min-w-[100px]">
                {(["black", "red", "blue"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setSignatureColor(c); setSigColorOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-[11px] font-semibold hover:bg-zinc-50 text-left ${signatureColor === c ? "bg-zinc-100" : ""}`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SIG_COLOR_HEX[c] }} />
                    {c === "black" ? "Hitam" : c === "red" ? "Merah" : "Biru"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] text-zinc-500">Tap dulu tombol ini di HP sebelum menulis.</span>
        </div>
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className={`w-full rounded-xl border-2 border-dashed bg-white touch-none ${
            signatureEnabled ? "border-zinc-300 cursor-crosshair" : "border-zinc-200 cursor-not-allowed opacity-70"
          }`}
          style={{ touchAksi: "none" }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerBatal={endDraw}
          onTouchStart={startDrawTouch}
          onTouchMove={drawTouch}
          onTouchEnd={endDraw}
          onTouchBatal={endDraw}
        />
        <button onClick={clearCanvas} className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 underline">
          Hapus tanda tangan
        </button>

        {/* Preview dokumen berstempel */}
        {modalLoan.image_url && (
          <div className="mt-4">
            <DraggableStampingPreview
              loanId={modalLoan.id}
              nominal={modalLoan.nominal_pengajuan}
              authToken={authToken}
              stampApplied={stampApplied}
              signatureB64={signatureEnabled ? canvasRef.current?.toDataURL("image/png") : undefined}
              onCoordinatesChange={setStampingCoords}
              stampColor={stampColor}
              stampName={stampName}
            />
          </div>
        )}

        {/* Stempel Koperasi */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={() => setStampApplied((s) => !s)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              stampApplied ? "border-blue-600 bg-blue-600 text-white" : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            {stampApplied ? "✓ Stempel Diterapkan" : "Beri Stempel Koperasi"}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setStampColorOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-400"
            >
              <span className="w-3 h-3 rounded-full border border-zinc-200 flex-shrink-0" style={{ background: STAMP_COLOR_HEX[stampColor] }} />
              <ChevronDown className="h-3 w-3" />
            </button>
            {stampColorOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 flex flex-col rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden min-w-[110px]">
                {(["red","blue","black","green","white","gold"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setStampColor(c); setStampColorOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-[11px] font-semibold hover:bg-zinc-50 text-left ${stampColor === c ? "bg-zinc-100" : ""}`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0 border border-zinc-200" style={{ background: STAMP_COLOR_HEX[c] }} />
                    {STAMP_COLOR_LABEL[c]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {stampApplied && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[10px] font-bold text-blue-700 tracking-wide">
              🏛 KOPERASI RESMI
            </span>
          )}
        </div>

        {stampApplied && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-[11px] font-semibold text-zinc-500 whitespace-nowrap">Nama Stempel:</span>
            <input
              type="text"
              value={stampName}
              onChange={(e) => setStampName(e.target.value.toUpperCase())}
              maxLength={40}
              className="flex-1 min-w-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-800 focus:border-blue-400 focus:outline-none"
              placeholder="KOPERASI MITRA SEJAHTERA"
            />
          </div>
        )}

        {approveError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">{approveError}</p>}
        
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
            Batal
          </button>
          <button onClick={handleApprove} disabled={signing} className="flex-1 rounded-full bg-black py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {signing ? "Menyegel..." : "Submit & Segel SHA-256"}
          </button>
        </div>
      </div>
    </div>
  );
}
