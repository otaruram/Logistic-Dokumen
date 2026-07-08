import React, { useState, useCallback } from "react";
import { Info, PenLine, X, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";
import { fmtRp } from "@/lib/formatters";
import {
  LoanRequest,
  SOURCE_INDICATOR,
  DOC_TYPE_LABEL,
  GAMIFICATION_TIER_BADGE,
  AI_FRAUD_BADGE,
  AI_BADGE_STYLE,
} from "./types";

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

interface QueueItemCardProps {
  loan: LoanRequest;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApprove: (loan: LoanRequest) => void;
  onReject: (loan: LoanRequest) => void;
  onRevise: (loan: LoanRequest) => void;
}

export default function QueueItemCard({
  loan,
  isExpanded,
  onToggleExpand,
  onApprove,
  onReject,
  onRevise,
}: QueueItemCardProps) {
  const [showFraudSummary, setShowFraudSummary] = useState(false);
  
  // AI Recommendation State
  const [aiRecLoading, setAiRecLoading] = useState(false);
  const [aiRecData, setAiRecData] = useState<any>(null);
  const [showAiRecModal, setShowAiRecModal] = useState(false);

  const fetchAiRecommendation = useCallback(async () => {
    if (aiRecData) {
      setShowAiRecModal(true);
      return;
    }
    setAiRecLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/kasbon/ai-recommendation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loan.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.recommendation) {
        setAiRecData({ ...data.recommendation, cached: data.cached });
        setShowAiRecModal(true);
      }
    } catch (e) {
      console.error("AI Rec error:", e);
    } finally {
      setAiRecLoading(false);
    }
  }, [loan.id, aiRecData]);

  const sourceConfig = SOURCE_INDICATOR[loan.source] || SOURCE_INDICATOR.CHAIN;
  const fraudConfig = AI_FRAUD_BADGE[loan.ai_fraud_status || "NEEDS_REVIEW"] || AI_FRAUD_BADGE.NEEDS_REVIEW;

  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white overflow-hidden ${sourceConfig.borderStyle}`}>
      {/* Source Indicator Banner */}
      <div className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase ${sourceConfig.style}`}>
        <span className="text-sm leading-none">{sourceConfig.icon}</span>
        <span>{sourceConfig.label}</span>
        {loan.doc_type && <span className="opacity-60 ml-1">· {DOC_TYPE_LABEL[loan.doc_type] || loan.doc_type}</span>}
      </div>

      {/* Main row */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50 transition-colors gap-3 sm:gap-0"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between sm:justify-start gap-4 min-w-0 w-full sm:w-auto">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 truncate">{loan.nama_lengkap || "-"}</p>
          </div>
          <div className="flex items-center gap-2 sm:hidden shrink-0">
            <span className="font-semibold text-zinc-900 text-sm">{fmtRp(loan.nominal_pengajuan)}</span>
            <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {loan.badge_tier && (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${GAMIFICATION_TIER_BADGE[loan.badge_tier] || "bg-zinc-100 text-zinc-700 border border-zinc-300"}`}>
              {loan.badge_tier}
            </span>
          )}
          {loan.ai_fraud_status && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${fraudConfig.style}`}>
              {fraudConfig.label}
            </span>
          )}
          {loan.ai_fraud_status && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFraudSummary(true);
              }}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
              title="Lihat Analisis AI"
            >
              <Info className="h-3 w-3" />
            </button>
          )}
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${AI_BADGE_STYLE[loan.ai_indicator] ?? ""}`}>
            {loan.ai_indicator}
          </span>
          <div className="hidden sm:flex items-center gap-3 ml-2">
            <span className="font-semibold text-zinc-900 text-sm">{fmtRp(loan.nominal_pengajuan)}</span>
            <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-zinc-100 px-5 py-4 bg-zinc-50 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoCard label="Kuota Sistem" value={fmtRp(loan.limit_pinjaman)} />
            <InfoCard label="Dokumen Aktif" value={fmtRp(loan.kasbon_aktif)} valueClass="text-amber-600" />
            <InfoCard label="Sisa Kuota Validasi" value={fmtRp(loan.sisa_limit)} valueClass={loan.sisa_limit <= 0 ? "text-red-600" : "text-emerald-600"} />
            <InfoCard label="Sisa Kredit" value={String(loan.sisa_kredit)} />
          </div>

          {(loan.kasbon_pending ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] text-amber-800">
                Reservasi pending: <span className="font-bold">{fmtRp(loan.kasbon_pending ?? 0)}</span>
                <span className="text-amber-700"> (ikut mengurangi sisa kuota sementara)</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoCard label="No. Referensi" value={loan.no_referensi || "-"} valueClass="font-mono" />
            <InfoCard label="Tanggal Bergabung" value={loan.member_since ? new Date(loan.member_since).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' }) : "-"} />
            <InfoCard label="DSR Status" value={loan.dsr_status ?? "-"} valueClass={loan.dsr_status === "OVER" ? "text-red-600" : "text-emerald-600"} />
          </div>

          {/* AI Fraud Analysis Card */}
          {loan.ai_fraud_status && (
            <div className={`rounded-xl border p-3 ${
              loan.ai_fraud_status === "FRAUD" ? "bg-red-950/50 border-red-800"
              : loan.ai_fraud_status === "NEEDS_REVIEW" ? "bg-yellow-950/50 border-yellow-800"
              : "bg-green-950/50 border-green-800"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                  loan.ai_fraud_status === "FRAUD" ? "text-red-400"
                  : loan.ai_fraud_status === "NEEDS_REVIEW" ? "text-yellow-400"
                  : "text-green-400"
                }`}>
                  {fraudConfig.icon} Analisis AI (Gemini)
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${fraudConfig.style}`}>
                  {fraudConfig.label}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{loan.ai_fraud_reason || "Tidak ada analisis AI tersedia."}</p>
            </div>
          )}

          {loan.badge_tier && (
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-[11px] font-semibold text-zinc-700 mb-1">Gamification Tier Pengaju</p>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${GAMIFICATION_TIER_BADGE[loan.badge_tier] || "bg-zinc-100 text-zinc-700 border border-zinc-300"}`}>
                {loan.badge_tier}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs text-zinc-500 font-medium">Dokumen:</p>
            {loan.image_url ? (
              <a href={loan.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline font-medium">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" x2="21" y1="14" y2="3" />
                </svg>
                Lihat Form Pengajuan
              </a>
            ) : <span className="text-xs text-zinc-400">Tidak ada dokumen</span>}
            <span className="text-xs text-zinc-400">·</span>
            <span className="text-xs text-zinc-400">{new Date(loan.submitted_at).toLocaleString("id-ID")}</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={(e) => { e.stopPropagation(); onApprove(loan); }} className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
              <PenLine className="h-3 w-3" /> Setujui
            </button>
            <button onClick={(e) => { e.stopPropagation(); onReject(loan); }} className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">
              <X className="h-3 w-3" /> Tolak
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRevise(loan); }} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-100">
              <AlertCircle className="h-3 w-3" /> Perlu Revisi
            </button>
            <button onClick={(e) => { e.stopPropagation(); fetchAiRecommendation(); }} disabled={aiRecLoading} className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors">
              {aiRecLoading ? <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {aiRecLoading ? "Menganalisis..." : "Saran AI"}
            </button>
          </div>
        </div>
      )}

      {/* Modals specific to this card */}
      {showFraudSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowFraudSummary(false)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                  loan.ai_fraud_status === "FRAUD" ? "bg-red-900/50" : loan.ai_fraud_status === "NEEDS_REVIEW" ? "bg-yellow-900/50" : "bg-green-900/50"
                }`}>
                  <span className="text-lg">{fraudConfig.icon}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Analisis AI Fraud</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Powered by Gemini 2.5 Flash</p>
                </div>
              </div>
              <button onClick={() => setShowFraudSummary(false)} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium">Status:</span>
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${fraudConfig.style}`}>{fraudConfig.label}</span>
              </div>
              <div className="rounded-xl bg-black/40 border border-zinc-800 p-4">
                <p className="text-sm text-zinc-300 leading-relaxed">{loan.ai_fraud_reason || "Tidak ada detail yang diberikan."}</p>
              </div>
              <p className="text-[10px] text-zinc-500 text-center pt-2">Model AI kami menganalisis KTP, tanda tangan, dan inkonsistensi teks menggunakan OCR & Vision.</p>
            </div>
          </div>
        </div>
      )}

      {showAiRecModal && aiRecData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowAiRecModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h3 className="text-lg font-semibold text-white">Rekomendasi AI</h3>
              </div>
              <button onClick={() => setShowAiRecModal(false)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <span className={`rounded-full px-4 py-1.5 text-sm font-bold tracking-wide border ${
                aiRecData.verdict === "APPROVE" ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                : aiRecData.verdict === "REJECT" ? "bg-red-950 text-red-400 border-red-800"
                : "bg-amber-950 text-amber-400 border-amber-800"
              }`}>{aiRecData.verdict}</span>
              <span className={`text-xs font-semibold ${
                aiRecData.risk === "RENDAH" ? "text-emerald-400"
                : aiRecData.risk === "TINGGI" ? "text-red-400"
                : aiRecData.risk === "KRITIS" ? "text-rose-500 animate-pulse font-black"
                : "text-amber-400"
              }`}>Risiko: {aiRecData.risk}</span>
              {aiRecData.cached && <span className="text-[10px] text-zinc-600 bg-zinc-800 rounded-full px-2 py-0.5">cached</span>}
            </div>

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
                <span className="text-zinc-300 font-medium">{sourceConfig.label}</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
              {aiRecData.text}
            </div>
            
            <p className="text-[10px] text-zinc-600 text-center pt-3">
              AI hanya bersifat advisory. Admin tetap memiliki kendali 100% atas keputusan.
            </p>
            <button onClick={() => setShowAiRecModal(false)} className="mt-4 w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
