import { motion } from "framer-motion";
import { Activity, ShieldCheck, Shield, TrendingUp, Zap, RefreshCw, Calendar, Trophy, Award, Star, ExternalLink, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { APP_CONFIG } from "@/constants";
import GamificationCard from "./GamificationCard";

const API_URL = APP_CONFIG.apiUrl;
const MAX_KASBON_LIMIT = 20_000_000; // Rp 20 Juta â€” Platinum tier max

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DashboardStats {
  trustScore: number;
  totalNominalVerified: number;
  totalDocuments: number;
  verifiedDocuments: number;
  tamperedDocuments: number;
  processingDocuments: number;
  totalActivity: number;
  totalScanFraud: number;
  credits: number;
  nextCleanupDays: number;
  nextCleanupDate: string;
}

interface AuditTrailItem {
  id: string;
  date: string;
  workerName: string;
  nominal: number;
  status: string;
  fileUrl: string;
  hash: string;
}

const DURATION_OPTIONS = [
  { key: "30d", label: "30 Hari" },
  { key: "6m", label: "6 Bulan" },
  { key: "1y", label: "1 Tahun" },
  { key: "all", label: "Semua" },
] as const;

const fmtRpDashboard = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const TotalActivityCard = ({ stats, loading }: { stats: DashboardStats; loading: boolean }) => {

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
      className="border border-white/10 rounded-2xl p-6 bg-gradient-to-br from-[#111] to-[#0d0d0d] flex flex-col justify-between relative overflow-hidden group"
    >
      <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/5 blur-3xl group-hover:bg-white/8 transition-colors pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Aktivitas</span>
        </div>
      </div>
      <div className="mt-5">
        <div className="text-6xl font-black tracking-tighter text-white tabular-nums">
          {loading ? <span className="text-gray-600 animate-pulse">â€”</span> : stats.totalActivity}
        </div>
        <p className="text-xs text-gray-500 mt-1 font-medium">
          Total aktivitas fraud scan
        </p>
      </div>
      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2">
        {[
          { label: "Fraud", value: stats.totalScanFraud },
          { label: "Verified", value: stats.verifiedDocuments },
          { label: "Tampered", value: stats.tamperedDocuments },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{item.label}</p>
            <p className="text-base font-bold text-white tabular-nums">{loading ? "..." : item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const CreditsCard = ({ stats, loading }: { stats: DashboardStats; loading: boolean }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
    className="border border-white/10 rounded-xl p-6 bg-white flex flex-col justify-between"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />
        </svg>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">CREDITS</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
          <line x1="21.17" x2="12" y1="8" y2="8" /><line x1="3.95" x2="8.54" y1="6.06" y2="14" /><line x1="10.88" x2="15.46" y1="21.94" y2="14" />
        </svg>
      </div>
    </div>
    <div className="mt-4">
      <div className="text-4xl font-black tracking-tighter text-black flex items-baseline gap-1">
        {loading ? "..." : stats.credits}<span className="text-xl text-gray-400 font-bold">/10</span>
      </div>
      <p className="text-xs text-gray-500 mt-2 font-medium">+1 kredit otomatis setiap hari (maks 10)</p>
    </div>
    <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2">
      {[{ label: "Deteksi Fraud", cost: "1 kredit" }, { label: "Validasi Signature", cost: "Included" }].map((item) => (
        <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{item.label}</p>
          <p className="text-sm font-bold text-black">{item.cost}<span className="text-gray-400 font-normal">{item.cost === "Included" ? "" : "/scan"}</span></p>
        </div>
      ))}
    </div>
  </motion.div>
);

// â”€â”€ Gamification: Consistency Mission Card (moved to GamificationCard.tsx) â”€â”€â”€â”€
const _GamificationCardLegacy = () => {
  const [badge, setBadge] = useState<any>(null);
  const [gLoading, setGLoading] = useState(true);

  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${API_URL}/api/v1/gamification/progress`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setBadge(await res.json());
      } catch {
        // Gamification is optional
      } finally {
        setGLoading(false);
      }
    };
    fetchBadge();
  }, []);

  const verified = badge?.verified_count ?? 0;
  const hasSilver = badge?.has_silver ?? false;
  const hasGold = badge?.has_gold ?? false;
  const hasPlatinum = badge?.has_platinum ?? false;
  const streakBroken = badge?.streak_broken ?? false;

  // Tier calculation: Platinum(250+) > Gold(150+) > Silver(50+) > Bronze
  const currentTier = hasPlatinum ? "Platinum" : hasGold ? "Gold" : hasSilver ? "Silver" : "Bronze";
  const tierColor = hasPlatinum ? "from-indigo-500 to-violet-400"
    : hasGold ? "from-amber-500 to-yellow-300"
    : hasSilver ? "from-gray-300 to-gray-100"
    : "from-orange-700 to-orange-500";
  const tierTextColor = hasPlatinum ? "text-indigo-400"
    : hasGold ? "text-amber-400"
    : hasSilver ? "text-gray-300"
    : "text-orange-400";

  // Next target threshold for progress bar
  const nextTarget = verified < 50 ? 50 : verified < 150 ? 150 : 250;
  const progressPct = Math.min((verified / nextTarget) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
      className="border border-white/10 rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-[#111] to-[#0a0a0a] relative overflow-hidden w-full box-border"
    >
      <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${tierColor} opacity-10 blur-3xl pointer-events-none`} />

      {/* Header */}
      <div className="flex flex-col gap-2 mb-4 w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className={`w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br ${tierColor} flex items-center justify-center shadow-lg`}>
              <Trophy className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0 overflow-hidden">
              <h3 className="font-bold text-white text-sm truncate">Consistency Mission</h3>
              <p className="text-[11px] text-gray-500 truncate">{badge?.month_year || "â€”"}</p>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r ${tierColor} text-black shrink-0 whitespace-nowrap`}>
            {currentTier}
          </div>
        </div>
      </div>

      {/* Zero-Tolerance Warning */}
      {streakBroken && (
        <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl w-full overflow-hidden">
          <p className="text-[11px] text-red-400 font-semibold break-words">âš ï¸ Streak Reset â€” Dokumen TAMPERED terdeteksi bulan ini.</p>
          <p className="text-[10px] text-red-400/70 mt-0.5 break-words">Badge dan benefit bulan ini ditangguhkan (Zero-Tolerance Policy).</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2 mb-5 w-full overflow-hidden">
        <div className="flex items-center justify-between text-xs w-full">
          <span className="text-gray-400 truncate">Dokumen Verified</span>
          <span className={`font-bold ${tierTextColor} shrink-0 ml-2`}>{gLoading ? "..." : verified} / {nextTarget}</span>
        </div>
        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden w-full">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${tierColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progressPct, 100)}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 w-full">
          <span>0</span>
          <span className="flex items-center gap-0.5"><Award className="w-3 h-3" /> 50</span>
          <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500" /> 150</span>
          <span>ðŸ’Ž 250</span>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
        <div className={`rounded-xl p-3 sm:p-4 border w-full overflow-hidden relative group transition-all duration-300 ${hasSilver ? "border-slate-500/50 bg-slate-800/60 shadow-[0_0_15px_-3px_rgba(148,163,184,0.2)]" : "border-white/5 bg-white/[0.02]"}`}>
          <div className={`absolute -right-4 -top-4 opacity-10 transition-opacity ${hasSilver ? "group-hover:opacity-20" : ""}`}>
             <Shield className={`w-20 h-20 ${hasSilver ? "text-slate-300" : "text-gray-600"}`} />
          </div>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <Shield className={`w-4 h-4 shrink-0 ${hasSilver ? "text-slate-300" : "text-gray-600"}`} />
            <span className={`text-sm font-bold tracking-wide ${hasSilver ? "text-slate-200" : "text-gray-600"}`}>Silver</span>
            {hasSilver && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded ml-auto">Aktif</span>}
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">50+ verified/bulan</p>
            <p className={`text-[10px] sm:text-xs font-semibold ${hasSilver ? "text-slate-300" : "text-gray-600"}`}>Plafon: Rp 5 Juta</p>
          </div>
        </div>
        
        <div className={`rounded-xl p-3 sm:p-4 border w-full overflow-hidden relative group transition-all duration-300 ${hasGold ? "border-amber-500/50 bg-amber-950/40 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]" : "border-white/5 bg-white/[0.02]"}`}>
          <div className={`absolute -right-4 -top-4 opacity-10 transition-opacity ${hasGold ? "group-hover:opacity-20" : ""}`}>
             <TrendingUp className={`w-20 h-20 ${hasGold ? "text-amber-500" : "text-gray-600"}`} />
          </div>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <TrendingUp className={`w-4 h-4 shrink-0 ${hasGold ? "text-amber-400" : "text-gray-600"}`} />
            <span className={`text-sm font-bold tracking-wide ${hasGold ? "text-amber-300" : "text-gray-600"}`}>Gold</span>
            {hasGold && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded ml-auto">Aktif</span>}
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">150+ verified/bulan</p>
            <p className={`text-[10px] sm:text-xs font-semibold ${hasGold ? "text-amber-400" : "text-gray-600"}`}>Plafon: Rp 10 Juta</p>
          </div>
        </div>
        
        <div className={`rounded-xl p-3 sm:p-4 border w-full overflow-hidden relative group transition-all duration-300 ${hasPlatinum ? "border-indigo-500/50 bg-indigo-950/40 shadow-[0_0_20px_-3px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/20" : "border-white/5 bg-white/[0.02]"}`}>
          <div className={`absolute -right-4 -top-4 opacity-10 transition-opacity ${hasPlatinum ? "group-hover:opacity-30" : ""}`}>
             <Zap className={`w-20 h-20 ${hasPlatinum ? "text-indigo-400" : "text-gray-600"}`} />
          </div>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <Zap className={`w-4 h-4 shrink-0 ${hasPlatinum ? "text-indigo-400" : "text-gray-600"}`} />
            <span className={`text-sm font-bold tracking-wide ${hasPlatinum ? "text-indigo-300" : "text-gray-600"}`}>Platinum</span>
            {hasPlatinum && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded ml-auto">Aktif</span>}
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">250+ verified/bulan</p>
            <p className={`text-[10px] sm:text-xs font-semibold ${hasPlatinum ? "text-indigo-400" : "text-gray-600"}`}>Plafon: Rp 20 Juta</p>
          </div>
        </div>
      </div>

      {/* Active Badge Banner */}
      {hasPlatinum && (
        <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl w-full overflow-hidden flex items-start gap-3">
          <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-indigo-300 font-medium break-words">Platinum Integrity Badge Aktif!</p>
            <p className="text-[11px] text-indigo-400/70 mt-0.5 break-words">Plafon Maksimal up to Rp 20 Juta & Pencairan Instan &lt; 5 Menit otomatis diterapkan.</p>
          </div>
        </div>
      )}
      {hasGold && !hasPlatinum && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl w-full overflow-hidden flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300 font-medium break-words">Gold Integrity Badge Aktif!</p>
            <p className="text-[11px] text-amber-400/70 mt-0.5 break-words">Plafon Maksimal up to Rp 10 Juta & Diskon Biaya Admin 0.5% otomatis diterapkan.</p>
          </div>
        </div>
      )}
      {hasSilver && !hasGold && !hasPlatinum && (
        <div className="mt-4 p-3 bg-slate-500/10 border border-slate-500/20 rounded-xl w-full overflow-hidden flex items-start gap-3">
          <Shield className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-slate-300 font-medium break-words">Silver Integrity Badge Aktif!</p>
            <p className="text-[11px] text-slate-400/70 mt-0.5 break-words">Plafon Maksimal up to Rp 5 Juta & Prioritas Pencairan 1x24 Jam otomatis diterapkan.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// SisaLimitCard removed — no longer displayed

const NominalVerifiedCard = ({ stats, loading }: {
  stats: DashboardStats; loading: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
    className="border border-white/10 rounded-2xl p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] relative overflow-hidden group"
  >
    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/10 transition-colors" />
    <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />
    <div className="relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-white/10 flex items-center justify-center border border-white/10">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Dokumen Aktif</span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400">IDR</span>
            </div>
          </div>
          <div className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">
            {loading ? <span className="text-gray-600 animate-pulse">—</span> : fmtRpDashboard(stats.totalNominalVerified)}
          </div>
          <p className="text-xs text-emerald-400/80 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />Dihitung real-time dari dokumen yang telah Approved
          </p>
        </div>
        <div className="flex-shrink-0 hidden sm:flex items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-white/5 flex items-center justify-center">
            <FileText className="w-8 h-8 text-emerald-500/40" />
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Verified", value: stats.verifiedDocuments, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          { label: "Processing", value: stats.processingDocuments, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
          { label: "Tampered", value: stats.tamperedDocuments, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
        ].map((item) => (
          <div key={item.label} className={`${item.bg} border ${item.border} rounded-xl px-3 py-3`}>
            <div className={`text-2xl font-bold ${item.color} tabular-nums`}>{loading ? "..." : item.value}</div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mt-1">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

// SecurityInfoCard removed — Cryptographic Security Active card no longer shown

// â”€â”€ STATUS BADGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatusBadge = ({ status }: { status: string }) => {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tracking-wide">APPROVED</span>;
  if (s === "REJECTED") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 tracking-wide">REJECTED</span>;
  if (s === "REVISION" || s === "NEED_REVISION") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 tracking-wide">REVISION</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30 tracking-wide">{s || "PENDING"}</span>;
};

// â”€â”€ MASTER AUDIT TRAIL TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ROWS_PER_PAGE = 10;

const MasterAuditTable = ({ items, loading }: { items: AuditTrailItem[]; loading: boolean }) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
  const paged = items.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  useEffect(() => { setPage(0); }, [items.length]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
      className="border border-white/10 rounded-2xl bg-[#111] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Master Data & Transaction Audit Trail</h4>
            <p className="text-[11px] text-gray-500">{items.length} transaksi tercatat</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-6">
          <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">Belum ada data transaksi.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tanggal/Waktu</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nama Pengaju</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nominal</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Dokumen</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">SHA-256 Seal</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item, i) => (
                  <tr key={item.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {item.date ? new Date(item.date).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "â€”"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white font-medium truncate max-w-[160px]">{item.workerName}</td>
                    <td className="px-4 py-3 text-xs text-white font-semibold text-right tabular-nums whitespace-nowrap">
                      {fmtRpDashboard(item.nominal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.fileUrl ? (
                        <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium">
                          <ExternalLink className="w-3 h-3" /> Lihat
                        </a>
                      ) : (
                        <span className="text-[11px] text-gray-600">â€”</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-gray-500 bg-white/5 px-2 py-1 rounded">
                        {item.hash && item.hash.length >= 8 ? item.hash.slice(0, 8) : "â€”"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <p className="text-[11px] text-gray-500">
                Halaman {page + 1} dari {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Prev
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DashboardTab = () => {
  const [stats, setStats] = useState<DashboardStats>({
    trustScore: 0, totalNominalVerified: 0, totalDocuments: 0,
    verifiedDocuments: 0, tamperedDocuments: 0, processingDocuments: 0,
    totalActivity: 0, totalScanFraud: 0,
    credits: 0, nextCleanupDays: 0, nextCleanupDate: "",
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditTrail, setAuditTrail] = useState<AuditTrailItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const isMounted = useRef(true);
  const refreshInFlight = useRef(false);
  const backendFailureCount = useRef(0);
  const backendCooldownUntil = useRef(0);

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (refreshInFlight.current) return;
    try {
      refreshInFlight.current = true;
      if (!silent) setLoading(true);
      if (!isMounted.current) return;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { toast.error("Anda harus login terlebih dahulu"); setLoading(false); return; }

      // â”€â”€ Primary: backend realtime-stats (uses supabase_admin â€” bypasses RLS) â”€â”€
      let backendOk = false;
      const nowMs = Date.now();
      try {
        if (nowMs >= backendCooldownUntil.current) {
          const statsRes = await fetch(`${API_URL}/api/dashboard/realtime-stats`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (statsRes.ok) {
            const d = await statsRes.json();
            backendFailureCount.current = 0;
            backendCooldownUntil.current = 0;

            // 2. Next cleanup (reuse existing logic)
            const now = new Date();
            const joinDate = session?.user?.created_at ? new Date(session.user.created_at) : now;
            let nextCleanupDate = new Date(now.getFullYear(), now.getMonth(), joinDate.getDate());
            if (nextCleanupDate <= now) nextCleanupDate = new Date(now.getFullYear(), now.getMonth() + 1, joinDate.getDate());
            const nextCleanupDays = Math.ceil((nextCleanupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const nextCleanupDateStr = nextCleanupDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

            // Cleanup API override
            let apiCleanupDays = nextCleanupDays, apiCleanupDate = nextCleanupDateStr;
            try {
              const cleanupRes = await fetch(`${API_URL}/api/cleanup/cleanup-stats`);
              if (cleanupRes.ok) {
                const c = await cleanupRes.json();
                apiCleanupDays = c.days_until_cleanup ?? nextCleanupDays;
                apiCleanupDate = c.next_cleanup_date ? new Date(c.next_cleanup_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : nextCleanupDateStr;
              }
            } catch {/* ignore */}

            if (isMounted.current) {
              setStats({
                trustScore: d.trust_score ?? 0,
                totalNominalVerified: d.total_nominal ?? 0,
                totalDocuments: d.total_scan_fraud ?? 0,
                verifiedDocuments: d.verified ?? 0,
                tamperedDocuments: d.tampered ?? 0,
                processingDocuments: d.processing ?? 0,
                totalActivity: d.total_scan_fraud ?? 0,
                totalScanFraud: d.total_scan_fraud ?? 0,
                credits: d.credits ?? 0,
                nextCleanupDays: apiCleanupDays,
                nextCleanupDate: apiCleanupDate,
              });
              setWeeklyData((d.weekly || []).map((w: any) => ({ day: w.day, scans: w.scans ?? 0 })));
              setLoading(false);
            }
            backendOk = true;
          } else {
            backendFailureCount.current += 1;
            const backoffSeconds = Math.min(60, Math.max(5, backendFailureCount.current * 5));
            backendCooldownUntil.current = Date.now() + backoffSeconds * 1000;
          }
        }
      } catch (backendErr) {
        backendFailureCount.current += 1;
        const backoffSeconds = Math.min(60, Math.max(5, backendFailureCount.current * 5));
        backendCooldownUntil.current = Date.now() + backoffSeconds * 1000;
        if (backendFailureCount.current <= 3 || backendFailureCount.current % 10 === 0) {
          console.warn("[Dashboard] backend realtime-stats failed, falling back to Supabase client", backendErr);
        }
      }

      if (backendOk) return;

      // â”€â”€ Fallback: direct Supabase client query (may be affected by RLS) â”€â”€
      const userId = session.user.id;
      const fraudQuery = supabase.from("fraud_scans").select("status, created_at, nominal_total").eq("user_id", userId);
      const { data: allFraud } = await fraudQuery;
      let verified = 0, tampered = 0, processing = 0;
      (allFraud || []).forEach((f: any) => {
        if (f.status === "verified") verified++;
        else if (f.status === "tampered") tampered++;
        else if (f.status === "processing") processing++;
      });

      let calculatedTrustScore = 0;
      const totalDocs = verified + processing + tampered;
      if (totalDocs > 0) {
        const rawScore = (verified * 100 + processing * 50 + tampered * 50) / totalDocs;
        calculatedTrustScore = Math.min(Math.round(rawScore * 10), 1000);
      }

      const totalVerif = (allFraud || []).reduce((sum: number, f: any) => f.status === "verified" ? sum + Number(f.nominal_total || 0) : sum, 0);

      let credits = 0;
      try {
        const creditsRes = await fetch(`${API_URL}/api/users/credits`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (creditsRes.ok) { credits = (await creditsRes.json()).credits ?? 0; }
      } catch { const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single(); credits = profile?.credits ?? 0; }

      const now = new Date();
      const joinDate = session?.user?.created_at ? new Date(session.user.created_at) : now;
      let nextCleanupDate = new Date(now.getFullYear(), now.getMonth(), joinDate.getDate());
      if (nextCleanupDate <= now) nextCleanupDate = new Date(now.getFullYear(), now.getMonth() + 1, joinDate.getDate());
      const nextCleanupDays = Math.ceil((nextCleanupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const nextCleanupDateStr = nextCleanupDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

      const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const dayOfWeek = now.getDay();
      const monday = new Date(now); monday.setDate(now.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)); monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
      const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
      let totalScanFraud = 0;
      (allFraud || []).forEach((s: any) => {
        totalScanFraud++;
        if (s.created_at) {
          const scanDate = new Date(s.created_at);
          if (scanDate >= monday && scanDate <= sunday) {
            const idx = scanDate.getDay() === 0 ? 6 : scanDate.getDay() - 1;
            dailyCounts[idx]++;
          }
        }
      });
      const weeklyChartData = dayNames.map((label, i) => ({ day: label, scans: dailyCounts[i] }));
      if (isMounted.current) setWeeklyData(weeklyChartData);

      let apiCleanupDays = nextCleanupDays, apiCleanupDate = nextCleanupDateStr;
      try {
        const cleanupRes = await fetch(`${API_URL}/api/cleanup/cleanup-stats`);
        if (cleanupRes.ok) {
          const c = await cleanupRes.json();
          apiCleanupDays = c.days_until_cleanup ?? nextCleanupDays;
          apiCleanupDate = c.next_cleanup_date ? new Date(c.next_cleanup_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : nextCleanupDateStr;
        }
      } catch {/* ignore */}

      if (isMounted.current) {
        setStats({
          trustScore: calculatedTrustScore, totalNominalVerified: totalVerif, totalDocuments: (allFraud || []).length,
          verifiedDocuments: verified, tamperedDocuments: tampered, processingDocuments: processing,
          totalActivity: totalScanFraud, totalScanFraud,
          credits, nextCleanupDays: apiCleanupDays, nextCleanupDate: apiCleanupDate,
        });
        setLoading(false);
      }
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) return;
      console.error("Dashboard fetch error:", error);
      if (isMounted.current) setLoading(false);
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  const fetchAuditTrail = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuditTrail([]);
        return;
      }
      const res = await fetch(`${API_URL}/api/kasbon/audit-trail`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        // Fallback to user history if audit-trail is admin-only
        const fallbackRes = await fetch(`${API_URL}/api/kasbon/history`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const history = (fallbackData?.history || []).map((h: any) => ({
            id: h.id,
            date: h.submitted_at,
            workerName: "Anda",
            nominal: h.nominal_pengajuan || 0,
            status: h.status,
            fileUrl: "",
            hash: h.sha256_hash || "",
          }));
          setAuditTrail(history);
        } else {
          setAuditTrail([]);
        }
        return;
      }
      const data = await res.json();
      setAuditTrail(data?.transactions || []);
    } catch {
      setAuditTrail([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    let subscription: ReturnType<typeof supabase.channel>;
    let realtimePoll: ReturnType<typeof setInterval> | undefined;

    const setupDashboard = async () => {
      await fetchDashboardData();
      await fetchAuditTrail();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      subscription = supabase.channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
          const newData = payload.new as Record<string, unknown>;
          if (newData && typeof newData.credits === 'number' && isMounted.current) setStats((prev) => ({ ...prev, credits: newData.credits as number }));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${userId}` }, () => { if (isMounted.current) fetchDashboardData(true); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'extracted_finance_data', filter: `user_id=eq.${userId}` }, () => { if (isMounted.current) fetchDashboardData(true); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fraud_scans', filter: `user_id=eq.${userId}` }, () => { if (isMounted.current) fetchDashboardData(true); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_requests' }, () => {
          if (isMounted.current) fetchAuditTrail();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` }, () => { if (isMounted.current) fetchDashboardData(true); })
        .subscribe();

      // Fallback realtime polling in case websocket/realtime channel drops.
      realtimePoll = setInterval(() => {
        if (isMounted.current) fetchDashboardData(true);
      }, 15000);
    };
    setupDashboard();

    const handleScanCompleted = () => {
      if (!isMounted.current) return;
      // Immediate refresh + delayed refresh to avoid DB write race conditions.
      fetchDashboardData(true);
      fetchAuditTrail();
      setTimeout(() => {
        if (isMounted.current) fetchDashboardData(true);
      }, 1500);
    };
    const handleFocusRefresh = () => {
      if (isMounted.current) fetchDashboardData(true);
    };
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible' && isMounted.current) {
        fetchDashboardData(true);
      }
    };
    window.addEventListener('scan-completed', handleScanCompleted);
    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      isMounted.current = false;
      window.removeEventListener('scan-completed', handleScanCompleted);
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      if (realtimePoll) clearInterval(realtimePoll);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [fetchDashboardData, fetchAuditTrail]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 space-y-6 text-white font-sans pb-32">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="border-b border-white/10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Monitor aktivitas dan performa finansial Anda</p>
          </div>
        </div>
      </motion.div>

      {/* Top Banner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TotalActivityCard stats={stats} loading={loading} />
        <CreditsCard stats={stats} loading={loading} />
      </div>

      {/* Total Dokumen Aktif — Full Width */}
      <NominalVerifiedCard stats={stats} loading={loading} />

      {/* Gamification — Consistency Mission */}
      <GamificationCard />

      {/* Master Data & Transaction Audit Trail */}
      <MasterAuditTable items={auditTrail} loading={auditLoading} />
    </div>
  );
};

export default DashboardTab;
