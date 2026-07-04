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
  member_since?: string;
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

export const GAMIFICATION_TIER_BADGE: Record<string, string> = {
  SILVER: "bg-slate-200 text-slate-700 border border-slate-300",
  GOLD: "bg-amber-100 text-amber-800 border border-amber-300",
  PLATINUM: "bg-violet-100 text-violet-800 border border-violet-300",
};

export const AI_BADGE_STYLE: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  TAMPERED: "bg-red-50 text-red-700 border border-red-200",
  PROCESSING: "bg-yellow-50 text-yellow-700 border border-yellow-200",
};

export const SOURCE_INDICATOR: Record<string, { label: string; icon: string; style: string; borderStyle: string }> = {
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

export const AI_FRAUD_BADGE: Record<string, { label: string; style: string; icon: string }> = {
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

export const DOC_TYPE_LABEL: Record<string, string> = {
  receipt: "Receipt",
  invoice: "Invoice",
  surat_jalan: "Surat Jalan",
  bon_bensin: "Bon Bensin",
  slip_gaji: "Salary Slip",
  struk_belanja: "Struk Belanja",
};

export const SIG_COLOR_HEX: Record<string, string> = {
  black: "#111827",
  red: "#dc2626",
  blue: "#1d4ed8",
};

export const STAMP_COLOR_HEX: Record<string, string> = {
  red: "#b40a0a",
  blue: "#003ca0",
  black: "#141414",
  green: "#006e28",
  white: "#e6e6e6",
  gold: "#b48c00",
};

export const STAMP_COLOR_LABEL: Record<string, string> = {
  red: "Merah", blue: "Biru", black: "Hitam",
  green: "Hijau", white: "Putih", gold: "Emas",
};
