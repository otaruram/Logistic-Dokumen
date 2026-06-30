import { motion } from "framer-motion";
import { Activity, ShieldCheck, TrendingUp, RefreshCw, Calendar, Trophy, Award, Star } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { APP_CONFIG } from "@/constants";
import GamificationCard from "./GamificationCard";
import TransactionTable, { Transaction } from "../TransactionTable";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const API_URL = APP_CONFIG.apiUrl;
const USD_RATE_FALLBACK = 16000; // Fallback IDR/USD rate

// ── Types ────────────────────────────────────────────────────────────────────

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

interface KasbonHistoryItem {
  id: string;
  nominal_pengajuan: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  ai_indicator: "PROCESSING" | "VERIFIED" | "TAMPERED";
  sha256_hash?: string | null;
  submitted_at?: string;
}

const DURATION_OPTIONS = [
  { key: "30d", label: "30 Hari" },
  { key: "6m", label: "6 Bulan" },
  { key: "1y", label: "1 Tahun" },
  { key: "all", label: "Semua" },
] as const;

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
          {loading ? <span className="text-gray-600 animate-pulse">—</span> : stats.totalActivity}
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
      <p className="text-xs text-gray-500 mt-2 font-medium">Reset setiap hari jam 00:00</p>
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

// ── Gamification: Consistency Mission Card (moved to GamificationCard.tsx) ────
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
              <p className="text-[11px] text-gray-500 truncate">{badge?.month_year || "—"}</p>
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
          <p className="text-[11px] text-red-400 font-semibold break-words">⚠️ Streak Reset — Dokumen TAMPERED terdeteksi bulan ini.</p>
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
          <span>💎 250</span>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
        <div className={`rounded-xl p-3 border w-full overflow-hidden ${hasSilver ? "border-gray-400/30 bg-gray-400/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-1">
            <Award className={`w-4 h-4 shrink-0 ${hasSilver ? "text-gray-300" : "text-gray-600"}`} />
            <span className={`text-xs font-bold ${hasSilver ? "text-gray-200" : "text-gray-600"}`}>Silver</span>
            {hasSilver && <span className="text-[10px] text-emerald-400">✓</span>}
          </div>
          <p className="text-[10px] text-gray-500 break-words">50+ verified/bulan</p>
          <p className="text-[10px] text-gray-500 break-words">Verified Badge</p>
        </div>
        <div className={`rounded-xl p-3 border w-full overflow-hidden ${hasGold ? "border-amber-500/30 bg-amber-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-1">
            <Star className={`w-4 h-4 shrink-0 ${hasGold ? "text-amber-400" : "text-gray-600"}`} />
            <span className={`text-xs font-bold ${hasGold ? "text-amber-300" : "text-gray-600"}`}>Gold</span>
            {hasGold && <span className="text-[10px] text-emerald-400">✓</span>}
          </div>
          <p className="text-[10px] text-gray-500 break-words">150+ verified/bulan</p>
          <p className={`text-[10px] break-words ${hasGold ? "text-amber-400 font-semibold" : "text-gray-500"}`}>Priority Approval Queue</p>
        </div>
        <div className={`rounded-xl p-3 border w-full overflow-hidden ${hasPlatinum ? "border-indigo-500/30 bg-indigo-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm shrink-0 ${hasPlatinum ? "" : "grayscale opacity-40"}`}>💎</span>
            <span className={`text-xs font-bold ${hasPlatinum ? "text-indigo-300" : "text-gray-600"}`}>Platinum</span>
            {hasPlatinum && <span className="text-[10px] text-emerald-400">✓</span>}
          </div>
          <p className="text-[10px] text-gray-500 break-words">250+ verified/bulan</p>
          <p className={`text-[10px] break-words ${hasPlatinum ? "text-indigo-400 font-semibold" : "text-gray-500"}`}>VIP Support & Instant Routing</p>
        </div>
      </div>

      {/* Active Badge Banner */}
      {hasPlatinum && (
        <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl w-full overflow-hidden">
          <p className="text-xs text-indigo-300 font-medium break-words">💎 Platinum Integrity Badge Aktif!</p>
          <p className="text-[11px] text-indigo-400/70 mt-0.5 break-words">VIP Support & Instant Decision Routing otomatis diterapkan. Sertifikat digital tersedia.</p>
        </div>
      )}
      {hasGold && !hasPlatinum && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl w-full overflow-hidden">
          <p className="text-xs text-amber-300 font-medium break-words">🏆 Gold Integrity Badge Aktif!</p>
          <p className="text-[11px] text-amber-400/70 mt-0.5 break-words">Priority Approval Queue otomatis diterapkan.</p>
        </div>
      )}
      {hasSilver && !hasGold && !hasPlatinum && (
        <div className="mt-4 p-3 bg-gray-400/10 border border-gray-400/20 rounded-xl w-full overflow-hidden">
          <p className="text-xs text-gray-300 font-medium break-words">🥈 Silver Integrity Badge Aktif!</p>
          <p className="text-[11px] text-gray-400/70 mt-0.5 break-words">Standard Queue aktif. Lanjutkan ke 150 dokumen untuk unlock Gold!</p>
        </div>
      )}
    </motion.div>
  );
};

const TrustScoreCard = ({ stats, loading }: { stats: DashboardStats; loading: boolean }) => {
  const SCORE_MAX = 1000;
  const currentScore = stats.trustScore;
  const data = [
    { name: "Score", value: currentScore },
    { name: "Remaining", value: SCORE_MAX - currentScore },
  ];
  const getScoreColor = (score: number) => {
    if (score >= 800) return "#10b981";
    if (score >= 500) return "#f59e0b";
    if (score >= 300) return "#f97316";
    return "#ef4444";
  };
  const scoreColor = getScoreColor(currentScore);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
      className="border border-white/10 rounded-xl p-6 bg-[#111] hover:bg-[#161616] transition-all flex flex-col items-center justify-center relative overflow-hidden"
    >
      <div className="absolute -top-10 flex w-full justify-center opacity-20 blur-2xl pointer-events-none"
        style={{ backgroundColor: scoreColor, width: "150px", height: "150px", borderRadius: "50%" }} />
      <div className="w-full flex items-start justify-between mb-2 z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" style={{ color: scoreColor }} />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Sisa Limit Kasbon</span>
        </div>
        {currentScore >= 800 && (
          <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">EXCELLENT</span>
        )}
      </div>
      <div className="h-48 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="70%" startAngle={180} endAngle={0} innerRadius={70} outerRadius={90} paddingAngle={0} dataKey="value" stroke="none">
              <Cell key="cell-0" fill={scoreColor} />
              <Cell key="cell-1" fill="#222" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 pointer-events-none">
          <span className="text-5xl font-bold text-white tracking-tighter shadow-sm" style={{ textShadow: `0 0 20px ${scoreColor}40` }}>
            {loading ? "..." : currentScore}
          </span>
          <span className="text-xs text-gray-500 mt-1">of 1000 Poin</span>
        </div>
      </div>
    </motion.div>
  );
};

const NominalVerifiedCard = ({ stats, loading, currency, onToggleCurrency, formatCurrency }: {
  stats: DashboardStats; loading: boolean; currency: "IDR" | "USD";
  onToggleCurrency: () => void; formatCurrency: (n: number) => string;
}) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
    className="border border-white/10 rounded-xl p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] relative overflow-hidden group"
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors" />
    <div className="flex items-start justify-between relative z-10">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-300" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Kasbon Aktif</span>
          </div>
          <button
            onClick={onToggleCurrency}
            className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-gray-300"
          >
            <RefreshCw className="w-3 h-3" />
            {currency}
          </button>
        </div>
        <div className="text-3xl font-bold text-white mb-2 tracking-tight">
          {loading ? "..." : formatCurrency(stats.totalNominalVerified)}
        </div>
        <p className="text-xs text-green-400 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />*Dihitung secara real-time dari dokumen yang telah Approved
        </p>
      </div>
    </div>
    <div className="mt-8 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center relative z-10">
      {[
        { label: "Verified", value: stats.verifiedDocuments, color: "text-green-400" },
        { label: "Processing", value: stats.processingDocuments, color: "text-yellow-500" },
        { label: "Tampered", value: stats.tamperedDocuments, color: "text-red-500" },
      ].map((item) => (
        <div key={item.label}>
          <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
          <div className="text-[10px] text-gray-500 uppercase">{item.label}</div>
        </div>
      ))}
    </div>
  </motion.div>
);

const SecurityInfoCard = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="border border-white/10 rounded-xl p-6 bg-[#111]">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10">
        <ShieldCheck className="w-6 h-6 text-gray-300" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-white mb-1">Cryptographic Security Active</h4>
        <p className="text-sm text-gray-400 leading-relaxed">
          Semua dokumen yang diproses menggunakan algoritma Anti-Fraud (Digital Signature Hash). Dokumen bertanda{" "}
          <strong className="text-red-400">Tampered</strong> tidak akan dihitung ke dalam Total Pendapatan atau skor kredit.
        </p>
      </div>
    </div>
  </motion.div>
);

const KasbonHistoryCard = ({ items, loading }: { items: KasbonHistoryItem[]; loading: boolean }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="border border-white/10 rounded-xl p-6 bg-[#111]">
    <div className="flex items-center justify-between mb-4">
      <h4 className="font-bold text-white">Histori Kasbon</h4>
      <span className="text-xs text-gray-500">Web User</span>
    </div>

    {loading ? (
      <p className="text-sm text-gray-500">Memuat histori...</p>
    ) : items.length === 0 ? (
      <p className="text-sm text-gray-500">Belum ada histori kasbon.</p>
    ) : (
      <div className="space-y-3">
        {items.map((item) => {
          let finalStatus = item.status;
          if (item.ai_indicator === "TAMPERED" || item.status === "REJECTED") finalStatus = "REJECTED";
          else if (item.ai_indicator === "UNCLEAR_BLURRY" || item.status === "NEED_REVISION") finalStatus = "NEED_REVISION";
          else if (item.status === "APPROVED") finalStatus = "APPROVED";
          else if (item.status === "PENDING") finalStatus = "PROCESSING";
          
          return (
          <div key={item.id} className="rounded-lg border border-white/10 p-3 bg-white/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white font-semibold">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(item.nominal_pengajuan)}
              </p>
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                finalStatus === "APPROVED" ? "bg-green-500/20 text-green-400" :
                finalStatus === "REJECTED" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"
              }`}>
                {finalStatus}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">AI: {finalStatus === "REJECTED" ? "DETECTED: FRAUD DSR/TAMPERED" : item.ai_indicator}</p>
            <p className="text-xs text-gray-500 mt-1">
              Integrity Seal: {item.sha256_hash ? `${item.sha256_hash.slice(0, 14)}...` : "Belum disegel"}
            </p>
          </div>
          );
        })}
      </div>
    )}
  </motion.div>
);

// ── Main Component ───────────────────────────────────────────────────────────

const DashboardTab = () => {
  const [stats, setStats] = useState<DashboardStats>({
    trustScore: 0, totalNominalVerified: 0, totalDocuments: 0,
    verifiedDocuments: 0, tamperedDocuments: 0, processingDocuments: 0,
    totalActivity: 0, totalScanFraud: 0,
    credits: 0, nextCleanupDays: 0, nextCleanupDate: "",
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR");
  const [usdRate, setUsdRate] = useState(USD_RATE_FALLBACK);
  const [kasbonHistory, setKasbonHistory] = useState<KasbonHistoryItem[]>([]);
  const [kasbonLoading, setKasbonLoading] = useState(true);
  const [auditTrail, setAuditTrail] = useState<Transaction[]>([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(true);
  const isMounted = useRef(true);
  const refreshInFlight = useRef(false);
  const backendFailureCount = useRef(0);
  const backendCooldownUntil = useRef(0);

  // Fetch USD rate on mount
  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(r => r.json())
      .then(d => { if (d?.rates?.IDR) setUsdRate(d.rates.IDR); })
      .catch(() => setUsdRate(USD_RATE_FALLBACK));
  }, []);

  const toggleCurrency = () => setCurrency(prev => prev === "IDR" ? "USD" : "IDR");

  const formatCurrency = (amountIDR: number) => {
    if (currency === "USD") {
      const usd = amountIDR / usdRate;
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd);
    }
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountIDR);
  };

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (refreshInFlight.current) return;
    try {
      refreshInFlight.current = true;
      if (!silent) setLoading(true);
      if (!isMounted.current) return;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { toast.error("Anda harus login terlebih dahulu"); setLoading(false); return; }

      // ── Primary: backend realtime-stats (uses supabase_admin — bypasses RLS) ──
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

      // ── Fallback: direct Supabase client query (may be affected by RLS) ──
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

  const fetchKasbonHistory = useCallback(async () => {
    setKasbonLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setKasbonHistory([]);
        return;
      }
      const res = await fetch(`${API_URL}/api/kasbon/history`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setKasbonHistory([]);
        return;
      }
      const data = await res.json();
      setKasbonHistory((data?.history || []).slice(0, 5));
    } catch {
      setKasbonHistory([]);
    } finally {
      setKasbonLoading(false);
    }
  }, []);

  const fetchAuditTrail = useCallback(async () => {
    setAuditTrailLoading(true);
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
        setAuditTrail([]);
        return;
      }
      const data = await res.json();
      setAuditTrail(data?.transactions || []);
    } catch {
      setAuditTrail([]);
    } finally {
      setAuditTrailLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    let subscription: ReturnType<typeof supabase.channel>;
    let realtimePoll: ReturnType<typeof setInterval> | undefined;

    const setupDashboard = async () => {
      await fetchDashboardData();
      await fetchKasbonHistory();
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
          if (isMounted.current) fetchKasbonHistory();
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
      fetchKasbonHistory();
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
  }, [fetchDashboardData, fetchKasbonHistory, fetchAuditTrail]);

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

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrustScoreCard stats={stats} loading={loading} />
        <NominalVerifiedCard stats={stats} loading={loading} currency={currency} onToggleCurrency={toggleCurrency} formatCurrency={formatCurrency} />
      </div>

      {/* Gamification — Consistency Mission */}
      <GamificationCard />

      {/* Info Cards */}
      <SecurityInfoCard />
      
      {/* Kasbon History & Audit Trail */}
      <div className="space-y-4 pt-4">
        <KasbonHistoryCard items={kasbonHistory} loading={kasbonLoading} />
        <TransactionTable transactions={auditTrail} loading={auditTrailLoading} />
      </div>
    </div>
  );
};

export default DashboardTab;
