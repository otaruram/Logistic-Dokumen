import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ClipboardList, ChevronDown, Info, PenLine, RefreshCw, Shield, Sparkles, X, Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { APP_CONFIG } from "@/constants";
import { supabase } from "@/lib/supabaseClient";
import { fmtRp } from "@/lib/formatters";
import DraggableStampingPreview, { StampingCoordinates } from "../dgtnz/DraggableStampingPreview";

const API = APP_CONFIG.apiUrl;

const SIG_COLOR_HEX: Record<string, string> = {
  black: "#111827",
  red: "#dc2626",
  blue: "#1d4ed8",
};
const STAMP_COLOR_HEX: Record<string, string> = {
  red: "#b40a0a",
  blue: "#003ca0",
  black: "#141414",
  green: "#006e28",
  white: "#e6e6e6",
  gold: "#b48c00",
};
const STAMP_COLOR_LABEL: Record<string, string> = {
  red: "Merah", blue: "Biru", black: "Hitam",
  green: "Hijau", white: "Putih", gold: "Emas",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoanRequest {
  id: string;
  nik: string;
  nama_lengkap: string;
  nominal_pengajuan: number;
  image_url: string;
  ai_indicator: "VERIFIED" | "TAMPERED" | "PROCESSING";
  submitted_at: string;
  limit_pinjaman: number;
  kasbon_aktif: number;
  kasbon_pending?: number;
  sisa_limit: number;
  sisa_kredit: number;
  // SOP fields
  tenor_bulan: number | null;
  cicilan_sistem: number | null;
  dsr_status: "AMAN" | "OVER" | null;
  no_referensi: string | null;
  // Queue separation
  source: "CHAIN" | "FINANCE" | string;
  doc_type: string | null;
  // AI Fraud Indicator (Gemini 2.5 Flash)
  ai_fraud_status: "TRUSTED" | "NEEDS_REVIEW" | "FRAUD" | null;
  ai_fraud_reason: string | null;
  badge_tier?: "SILVER" | "GOLD" | "PLATINUM" | null;
}

const GAMIFICATION_TIER_BADGE: Record<string, string> = {
  SILVER: "bg-slate-200 text-slate-700 border border-slate-300",
  GOLD: "bg-amber-100 text-amber-800 border border-amber-300",
  PLATINUM: "bg-violet-100 text-violet-800 border border-violet-300",
};

const AI_BADGE_STYLE: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  TAMPERED: "bg-red-50 text-red-700 border border-red-200",
  PROCESSING: "bg-yellow-50 text-yellow-700 border border-yellow-200",
};

const SOURCE_INDICATOR: Record<string, { label: string; icon: string; style: string; borderStyle: string }> = {
  CHAIN: {
    label: "OTARUCHAIN — OPERATIONAL",
    icon: "🧾",
    style: "bg-slate-800 text-slate-200",
    borderStyle: "border-l-4 border-l-slate-500",
  },
  FINANCE: {
    label: "OTARUFINANCIAL — INCOME",
    icon: "💰",
    style: "bg-emerald-900 text-emerald-200",
    borderStyle: "border-l-4 border-l-emerald-400",
  },
};

const AI_FRAUD_BADGE: Record<string, { label: string; style: string; icon: string }> = {
  TRUSTED: {
    label: "AI: Trusted",
    style: "bg-green-900 text-green-300 border border-green-700",
    icon: "✓",
  },
  NEEDS_REVIEW: {
    label: "AI: Perlu Review",
    style: "bg-yellow-900 text-yellow-300 border border-yellow-700",
    icon: "⚡",
  },
  FRAUD: {
    label: "⚠️ Indikasi Manipulasi",
    style: "bg-red-900 text-red-300 border border-red-700",
    icon: "⚠️",
  },
};

const DOC_TYPE_LABEL: Record<string, string> = {
  receipt: "Receipt",
  invoice: "Invoice",
  surat_jalan: "Surat Jalan",
  bon_bensin: "Bon Bensin",
  slip_gaji: "Salary Slip",
  struk_belanja: "Struk Belanja",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApprovalQueueTab() {
  const [queue, setQueue] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Admin access
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [showAdminRequests, setShowAdminRequests] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const [authorizedAdmins, setAuthorizedAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Approve modal
  const [modalLoan, setModalLoan] = useState<LoanRequest | null>(null);
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
  const [authToken, setAuthToken] = useState<string>("");

  // Reject modal
  const [rejectLoan, setRejectLoan] = useState<LoanRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Revision modal
  const [revisionLoan, setRevisionLoan] = useState<LoanRequest | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisioning, setRevisioning] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // AI Fraud summary modal
  const [fraudSummaryLoan, setFraudSummaryLoan] = useState<LoanRequest | null>(null);

  // AI Recommendation per card
  const [aiRecLoading, setAiRecLoading] = useState<Record<string, boolean>>({});
  const [aiRecData, setAiRecData] = useState<Record<string, { text: string; verdict: string; risk: string; cached?: boolean }>>({});
  const [aiRecModalId, setAiRecModalId] = useState<string | null>(null);

  const fetchAiRecommendation = useCallback(async (loanId: string) => {
    // If already loaded, just show modal
    if (aiRecData[loanId]) {
      setAiRecModalId(loanId);
      return;
    }
    setAiRecLoading((prev) => ({ ...prev, [loanId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${API}/api/kasbon/ai-recommendation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loanId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.recommendation) {
        setAiRecData((prev) => ({ ...prev, [loanId]: { ...data.recommendation, cached: data.cached } }));
        setAiRecModalId(loanId);
      }
    } catch (e) {
      console.error("AI Rec error:", e);
    } finally {
      setAiRecLoading((prev) => ({ ...prev, [loanId]: false }));
    }
  }, [aiRecData]);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Login diperlukan.");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setAuthToken(token);
      const res = await fetch(`${API}/api/kasbon/queue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueue(data.queue ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat antrian.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/kasbon/admin-access-requests`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminRequests(data.requests || []);
      }
    } catch {}
  };

  const fetchAdmins = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/kasbon/authorized-admins`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuthorizedAdmins(data.admins || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (userEmail === "okitr52@gmail.com") {
      fetchAdminRequests();
      fetchAdmins();
    }
  }, [userEmail]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleRequestAccess = async () => {
    setRequestingAccess(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/kasbon/request-admin-access`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setRequestSuccess(data.message || "Request sent");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRequestingAccess(false);
    }
  };

  const handleApproveAdmin = async (id: string, action: "approve" | "reject") => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/kasbon/approve-admin-access`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: id, action })
      });
      if (res.ok) {
        fetchAdminRequests();
        fetchAdmins();
      }
    } catch {}
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim() || isAddingAdmin) return;
    setIsAddingAdmin(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/kasbon/authorized-admins`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setNewAdminEmail("");
        fetchAdmins();
        toast.success(data.message || "Admin added");
      } else {
        toast.error(data.detail || "Gagal menambah admin");
      }
    } catch (e: any) {
      toast.error("Terjadi kesalahan: " + e.message);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Yakin ingin menghapus akses admin untuk ${email}?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/kasbon/authorized-admins/${email}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchAdmins();
        toast.success(data.message || "Admin dihapus");
      } else {
        toast.error(data.detail || "Gagal menghapus admin");
      }
    } catch (e: any) {
      toast.error("Terjadi kesalahan: " + e.message);
    }
  };

  // Init canvas when modal opens
  useEffect(() => {
    if (modalLoan && canvasRef.current) {
      _initCanvas(canvasRef.current);
    }
  }, [modalLoan?.id]);

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

  // ── Actions ──────────────────────────────────────────────────────────────────

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Login diperlukan.");
      const res = await fetch(`${API}/api/kasbon/approve-loan`, {
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
      setModalLoan(null);
      setStampApplied(false);
      setStampStyle("classic");
      setStampColor("red");
      setStampName("KOPERASI MITRA SEJAHTERA");
      setStampColorOpen(false);
      setSignatureColor("black");
      setSigColorOpen(false);
      setSignatureEnabled(false);
      await fetchQueue();
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : "Gagal approve.");
    } finally {
      setSigning(false);
    }
  };

  const handleReject = async () => {
    if (!rejectLoan) return;
    setRejecting(true);
    setRejectError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Login diperlukan.");
      const res = await fetch(`${API}/api/kasbon/reject-loan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: rejectLoan.id, reason: rejectReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      setRejectLoan(null);
      setRejectReason("");
      await fetchQueue();
    } catch (e: unknown) {
      setRejectError(e instanceof Error ? e.message : "Gagal menolak pengajuan.");
    } finally {
      setRejecting(false);
    }
  };

  const handleRevision = async () => {
    if (!revisionLoan) return;
    setRevisioning(true);
    setRevisionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Login diperlukan.");
      const res = await fetch(`${API}/api/kasbon/need-revision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: revisionLoan.id, notes: revisionNotes || "Harap perbaiki dokumen." }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      setRevisionLoan(null);
      setRevisionNotes("");
      await fetchQueue();
    } catch (e: unknown) {
      setRevisionError(e instanceof Error ? e.message : "Gagal mengirim notif revisi.");
    } finally {
      setRevisioning(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Antrean Kasbon</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Pengajuan yang menunggu persetujuan koperasi.</p>
        </div>
        <div className="flex items-center gap-2">
          {userEmail === "okitr52@gmail.com" && (
            <button
              onClick={() => setShowAdminRequests(true)}
              className="relative p-2.5 rounded-full hover:bg-zinc-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-zinc-600" />
              {adminRequests.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          )}
          <button
            onClick={fetchQueue}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
        </div>
      )}
      
      {error && error.includes("403") ? (
        <div className="text-center py-16 border border-zinc-200 bg-white rounded-2xl shadow-sm px-4">
          <Shield className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">Akses Terbatas</h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
            Kamu tidak memiliki akses ke Approval Queue. Silakan minta akses untuk dapat mereview pengajuan.
          </p>
          {requestSuccess ? (
            <p className="text-sm text-emerald-600 bg-emerald-50 py-2.5 px-5 rounded-full inline-block font-medium border border-emerald-100">
              {requestSuccess}
            </p>
          ) : (
            <button
              onClick={handleRequestAccess}
              disabled={requestingAccess}
              className="inline-flex items-center justify-center rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {requestingAccess ? "Mengirim..." : "Request Akses Admin"}
            </button>
          )}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl p-4">{error}</p>
      ) : null}

      {!loading && !error && queue.length === 0 && (
        <div className="text-center py-16 border border-dashed border-zinc-300 rounded-2xl">
          <ClipboardList className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 font-medium">Tidak ada pengajuan yang menunggu.</p>
        </div>
      )}

      {!loading && queue.length > 0 && (
        <div className="space-y-3">
          {queue.map((loan) => (
            <div key={loan.id} className={`rounded-2xl border border-zinc-200 bg-white overflow-hidden ${(SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN).borderStyle}`}>
              {/* Source Indicator Banner */}
              <div className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase ${(SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN).style}`}>
                <span className="text-sm leading-none">{(SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN).icon}</span>
                <span>{(SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN).label}</span>
                {loan.doc_type && (
                  <span className="opacity-60 ml-1">· {DOC_TYPE_LABEL[loan.doc_type] || loan.doc_type}</span>
                )}
              </div>
              {/* Main row */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">{loan.nama_lengkap || "-"}</p>
                    <p className="text-xs text-zinc-400 font-mono">{loan.nik}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {loan.badge_tier && (
                    <span
                      className={`hidden sm:inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        GAMIFICATION_TIER_BADGE[loan.badge_tier] || "bg-zinc-100 text-zinc-700 border border-zinc-300"
                      }`}
                    >
                      {loan.badge_tier}
                    </span>
                  )}
                  {/* AI Fraud Badge */}
                  {loan.ai_fraud_status && (
                    <span
                      className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        (AI_FRAUD_BADGE[loan.ai_fraud_status] || AI_FRAUD_BADGE.NEEDS_REVIEW).style
                      }`}
                    >
                      {(AI_FRAUD_BADGE[loan.ai_fraud_status] || AI_FRAUD_BADGE.NEEDS_REVIEW).label}
                    </span>
                  )}
                  {/* AI Summary Button */}
                  {loan.ai_fraud_status && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFraudSummaryLoan(loan);
                      }}
                      className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-full border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                      title="Lihat Analisis AI"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  )}
                  <span
                    className={`hidden sm:inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                      AI_BADGE_STYLE[loan.ai_indicator] ?? ""
                    }`}
                  >
                    {loan.ai_indicator}
                  </span>
                  <span className="font-semibold text-zinc-900 text-sm">{fmtRp(loan.nominal_pengajuan)}</span>
                  <svg
                    className={`w-4 h-4 text-zinc-400 transition-transform ${expandedId === loan.id ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === loan.id && (
                <div className="border-t border-zinc-100 px-5 py-4 bg-zinc-50 space-y-4">
                  {/* Limit grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <InfoCard label="Limit Kasbon" value={fmtRp(loan.limit_pinjaman)} />
                    <InfoCard label="Total Kasbon Aktif" value={fmtRp(loan.kasbon_aktif)} valueClass="text-amber-600" />
                    <InfoCard
                      label="Sisa Limit Kasbon"
                      value={fmtRp(loan.sisa_limit)}
                      valueClass={loan.sisa_limit <= 0 ? "text-red-600" : "text-emerald-600"}
                    />
                    <InfoCard label="Sisa Kredit" value={String(loan.sisa_kredit)} />
                  </div>

                  {(loan.kasbon_pending ?? 0) > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] text-amber-800">
                        Reservasi pending: <span className="font-bold">{fmtRp(loan.kasbon_pending ?? 0)}</span>
                        <span className="text-amber-700"> (ikut mengurangi sisa limit sementara)</span>
                      </p>
                    </div>
                  )}

                  {/* SOP grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <InfoCard label="No. Referensi" value={loan.no_referensi || "-"} valueClass="font-mono" />

                    <InfoCard
                      label="DSR Status"
                      value={loan.dsr_status ?? "-"}
                      valueClass={loan.dsr_status === "OVER" ? "text-red-600" : "text-emerald-600"}
                    />
                  </div>

                  {/* AI Fraud Analysis Card (Mobile + Desktop) */}
                  {loan.ai_fraud_status && (
                    <div className={`rounded-xl border p-3 ${
                      loan.ai_fraud_status === "FRAUD"
                        ? "bg-red-950/50 border-red-800"
                        : loan.ai_fraud_status === "NEEDS_REVIEW"
                        ? "bg-yellow-950/50 border-yellow-800"
                        : "bg-green-950/50 border-green-800"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                          loan.ai_fraud_status === "FRAUD"
                            ? "text-red-400"
                            : loan.ai_fraud_status === "NEEDS_REVIEW"
                            ? "text-yellow-400"
                            : "text-green-400"
                        }`}>
                          {(AI_FRAUD_BADGE[loan.ai_fraud_status] || AI_FRAUD_BADGE.NEEDS_REVIEW).icon}{" "}
                          Analisis AI (Gemini)
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${
                          (AI_FRAUD_BADGE[loan.ai_fraud_status] || AI_FRAUD_BADGE.NEEDS_REVIEW).style
                        }`}>
                          {(AI_FRAUD_BADGE[loan.ai_fraud_status] || AI_FRAUD_BADGE.NEEDS_REVIEW).label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {loan.ai_fraud_reason || "Tidak ada analisis AI tersedia."}
                      </p>
                    </div>
                  )}

                  {loan.badge_tier && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-[11px] font-semibold text-zinc-700 mb-1">Gamification Tier Pengaju</p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                          GAMIFICATION_TIER_BADGE[loan.badge_tier] || "bg-zinc-100 text-zinc-700 border border-zinc-300"
                        }`}
                      >
                        {loan.badge_tier}
                      </span>
                    </div>
                  )}

                  {/* Document link */}
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-zinc-500 font-medium">Dokumen:</p>
                    {loan.image_url ? (
                      <a
                        href={loan.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" x2="21" y1="14" y2="3" />
                        </svg>
                        Lihat Form Pengajuan
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">Tidak ada dokumen</span>
                    )}
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs text-zinc-400">
                      {new Date(loan.submitted_at).toLocaleString("id-ID")}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalLoan(loan);
                        setApproveError(null);
                        setStampApplied(false);
                        setStampStyle("classic");
                        setSignatureEnabled(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      <PenLine className="h-3 w-3" /> Setujui
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectLoan(loan);
                        setRejectReason("");
                        setRejectError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                    >
                      <X className="h-3 w-3" /> Tolak
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevisionLoan(loan);
                        setRevisionNotes("");
                        setRevisionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-100"
                    >
                      <AlertCircle className="h-3 w-3" /> Perlu Revisi
                    </button>
                    {/* AI Recommendation Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchAiRecommendation(loan.id);
                      }}
                      disabled={aiRecLoading[loan.id]}
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-wait transition-colors"
                    >
                      {aiRecLoading[loan.id] ? (
                        <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {aiRecLoading[loan.id] ? "Menganalisis..." : "Saran AI"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {modalLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Setujui Pengajuan</h3>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {modalLoan.nama_lengkap} – {fmtRp(modalLoan.nominal_pengajuan)}
                </p>
              </div>
              <button
                onClick={() => setModalLoan(null)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tanda Tangan Digital */}
            <p className="text-xs text-zinc-500 mb-2">
              Tandatangani di bawah untuk menyetujui pengajuan kasbon ini:
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSignatureEnabled((v) => !v);
                  if (!signatureEnabled && canvasRef.current) {
                    _initCanvas(canvasRef.current, SIG_COLOR_HEX[signatureColor]);
                  }
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  signatureEnabled
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                {signatureEnabled ? "TTD Aktif" : "Aktifkan TTD"}
              </button>
              {/* Signature color dropdown */}
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
                signatureEnabled
                  ? "border-zinc-300 cursor-crosshair"
                  : "border-zinc-200 cursor-not-allowed opacity-70"
              }`}
              style={{ touchAction: "none" }}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              onPointerCancel={endDraw}
              onTouchStart={startDrawTouch}
              onTouchMove={drawTouch}
              onTouchEnd={endDraw}
              onTouchCancel={endDraw}
            />
            <button
              onClick={clearCanvas}
              className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 underline"
            >
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStampApplied((s) => !s)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  stampApplied
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                {stampApplied ? "✓ Stempel Diterapkan" : "Beri Stempel Koperasi"}
              </button>
              {/* Stamp color dropdown */}
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

            {/* Stamp name editor */}
            {stampApplied && (
              <div className="flex flex-wrap items-center gap-2">
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

            {approveError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">{approveError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setModalLoan(null);
                  setStampApplied(false);
                  setStampStyle("classic");
                  setStampColor("red");
                  setStampName("KOPERASI MITRA SEJAHTERA");
                  setStampColorOpen(false);
                  setSignatureColor("black");
                  setSigColorOpen(false);
                }}
                className="flex-1 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
              >
                Batal
              </button>
              <button
                onClick={handleApprove}
                disabled={signing}
                className="flex-1 rounded-full bg-black py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {signing ? "Menyegel..." : "Submit & Segel SHA-256"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-red-100 bg-white shadow-2xl overflow-hidden">
            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900">Tolak Pengajuan</h3>
                  <p className="text-sm text-red-600/80 mt-0.5 font-medium">
                    {rejectLoan.nama_lengkap} – {fmtRp(rejectLoan.nominal_pengajuan)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectLoan(null)}
                className="rounded-full p-1.5 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm text-zinc-700 font-semibold mb-2">
                Alasan Penolakan <span className="text-zinc-400 font-normal">(Opsional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Contoh: Nominal pengajuan melebihi sisa plafon, atau dokumen terindikasi fraud."
                className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-50 focus:border-red-300 resize-none transition-all"
              />
              {rejectError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{rejectError}</p>
                </div>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setRejectLoan(null)}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700 hover:shadow-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {rejecting ? "Memproses..." : "Konfirmasi Tolak"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {revisionLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-100 bg-white shadow-2xl overflow-hidden">
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900">Perlu Revisi</h3>
                  <p className="text-sm text-amber-700/80 mt-0.5 font-medium">
                    {revisionLoan.nama_lengkap} – {fmtRp(revisionLoan.nominal_pengajuan)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRevisionLoan(null)}
                className="rounded-full p-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm text-zinc-700 font-semibold mb-2">
                Catatan Revisi <span className="text-red-500">*</span>
              </label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                rows={3}
                placeholder="Berikan instruksi yang jelas. Contoh: Foto KTP terpotong, harap upload ulang dengan pencahayaan terang."
                className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-50 focus:border-amber-400 resize-none transition-all"
              />
              {revisionError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{revisionError}</p>
                </div>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setRevisionLoan(null)}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleRevision}
                  disabled={revisioning || !revisionNotes.trim()}
                  className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-200 hover:bg-amber-600 hover:shadow-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {revisioning ? "Mengirim Notif..." : "Kirim Catatan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Fraud Summary Modal */}
      {fraudSummaryLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setFraudSummaryLoan(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                  fraudSummaryLoan.ai_fraud_status === "FRAUD"
                    ? "bg-red-900/50"
                    : fraudSummaryLoan.ai_fraud_status === "NEEDS_REVIEW"
                    ? "bg-yellow-900/50"
                    : "bg-green-900/50"
                }`}>
                  <span className="text-lg">
                    {fraudSummaryLoan.ai_fraud_status === "FRAUD" ? "🚨" : fraudSummaryLoan.ai_fraud_status === "NEEDS_REVIEW" ? "⚡" : "✅"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Analisis AI Fraud</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Powered by Gemini 2.5 Flash
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFraudSummaryLoan(null)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium">Status:</span>
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${
                  (AI_FRAUD_BADGE[fraudSummaryLoan.ai_fraud_status || "NEEDS_REVIEW"] || AI_FRAUD_BADGE.NEEDS_REVIEW).style
                }`}>
                  {(AI_FRAUD_BADGE[fraudSummaryLoan.ai_fraud_status || "NEEDS_REVIEW"] || AI_FRAUD_BADGE.NEEDS_REVIEW).label}
                </span>
              </div>

              {/* Document Info */}
              <div className="bg-zinc-800/50 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Pemohon</span>
                  <span className="text-zinc-300 font-medium">{fraudSummaryLoan.nama_lengkap}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Nominal</span>
                  <span className="text-zinc-300 font-medium">{fmtRp(fraudSummaryLoan.nominal_pengajuan)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Sumber</span>
                  <span className="text-zinc-300 font-medium">{fraudSummaryLoan.source}</span>
                </div>
              </div>

              {/* AI Reason */}
              <div>
                <p className="text-xs text-zinc-500 font-medium mb-1.5">Alasan AI:</p>
                <div className={`rounded-xl border p-3 text-sm leading-relaxed ${
                  fraudSummaryLoan.ai_fraud_status === "FRAUD"
                    ? "bg-red-950/30 border-red-800/50 text-red-300"
                    : fraudSummaryLoan.ai_fraud_status === "NEEDS_REVIEW"
                    ? "bg-yellow-950/30 border-yellow-800/50 text-yellow-300"
                    : "bg-green-950/30 border-green-800/50 text-green-300"
                }`}>
                  {fraudSummaryLoan.ai_fraud_reason || "Tidak ada analisis AI tersedia."}
                </div>
              </div>

              {/* Admin note */}
              <p className="text-[10px] text-zinc-600 text-center pt-1">
                AI hanya bersifat advisory. Admin tetap memiliki kendali 100% untuk approve/reject.
              </p>
            </div>

            <button
              onClick={() => setFraudSummaryLoan(null)}
              className="mt-4 w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* AI Recommendation Modal */}
      {aiRecModalId && aiRecData[aiRecModalId] && (() => {
        const rec = aiRecData[aiRecModalId];
        const loan = queue.find((l) => l.id === aiRecModalId);
        const verdictStyle =
          rec.verdict === "TERIMA"
            ? "bg-emerald-900 text-emerald-300 border-emerald-700"
            : rec.verdict === "TOLAK"
            ? "bg-red-900 text-red-300 border-red-700"
            : "bg-amber-900 text-amber-300 border-amber-700";
        const riskStyle =
          rec.risk === "RENDAH"
            ? "text-emerald-400"
            : rec.risk === "TINGGI"
            ? "text-red-400"
            : rec.risk === "KRITIS"
            ? "text-rose-500 animate-pulse font-black"
            : "text-amber-400";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setAiRecModalId(null)}>
            <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                  <h3 className="text-lg font-semibold text-white">Rekomendasi AI</h3>
                </div>
                <button onClick={() => setAiRecModalId(null)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
              </div>

              {/* Verdict Badge */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`rounded-full px-4 py-1.5 text-sm font-bold tracking-wide border ${verdictStyle}`}>
                  {rec.verdict}
                </span>
                <span className={`text-xs font-semibold ${riskStyle}`}>Risiko: {rec.risk}</span>
                {rec.cached && <span className="text-[10px] text-zinc-600 bg-zinc-800 rounded-full px-2 py-0.5">cached</span>}
              </div>

              {/* Applicant Info */}
              {loan && (
                <div className="bg-zinc-800/50 rounded-xl p-3 space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Pemohon</span>
                    <span className="text-zinc-300 font-medium">{loan.nama_lengkap}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Nominal</span>
                    <span className="text-zinc-300 font-medium">{fmtRp(loan.nominal_pengajuan)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Sumber</span>
                    <span className="text-zinc-300 font-medium">
                      {(SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN).icon}{" "}
                      {(SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN).label}
                    </span>
                  </div>
                </div>
              )}

              {/* AI Analysis Text */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                {rec.text}
              </div>

              <p className="text-[10px] text-zinc-600 text-center pt-3">
                AI hanya bersifat advisory. Admin tetap memiliki kendali 100% atas keputusan.
              </p>

              <button
                onClick={() => setAiRecModalId(null)}
                className="mt-4 w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        );
      })()}

      {/* Admin Management Modal */}
      {showAdminRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowAdminRequests(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6 sticky top-0 bg-white pb-2 border-b border-zinc-100 z-10">
              <h3 className="text-lg font-bold text-zinc-900">Kelola Akses Admin</h3>
              <button onClick={() => setShowAdminRequests(false)} className="text-zinc-500 hover:text-zinc-700 bg-zinc-100 p-1.5 rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Add New Admin */}
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Tambah Admin Langsung</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                />
                <button
                  onClick={handleAddAdmin}
                  disabled={isAddingAdmin || !newAdminEmail.trim()}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  Tambah
                </button>
              </div>
            </div>

            {/* Active Admins */}
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Admin Aktif ({authorizedAdmins.length})</p>
              {authorizedAdmins.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">Belum ada admin lain.</p>
              ) : (
                <div className="space-y-2">
                  {authorizedAdmins.map((adm) => (
                    <div key={adm.email} className="flex items-center justify-between border border-zinc-200 rounded-xl p-3 bg-zinc-50">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{adm.email}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Disetujui oleh: {adm.approved_by || "-"}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(adm.email)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus akses admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Requests */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Permintaan Akses Baru ({adminRequests.length})</p>
              {adminRequests.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">Tidak ada permintaan akses baru.</p>
              ) : (
                <div className="space-y-3">
                  {adminRequests.map((req) => (
                    <div key={req.id} className="border border-amber-200 rounded-xl p-3 bg-amber-50">
                      <p className="text-sm font-semibold text-amber-900 truncate">{req.email}</p>
                      <p className="text-[10px] text-amber-700 mb-3">{new Date(req.requested_at).toLocaleString("id-ID")}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveAdmin(req.id, "approve")}
                          className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => handleApproveAdmin(req.id, "reject")}
                          className="flex-1 rounded-lg border border-red-200 bg-white py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoCard({
  label,
  value,
  valueClass = "text-zinc-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-3 py-2.5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}
