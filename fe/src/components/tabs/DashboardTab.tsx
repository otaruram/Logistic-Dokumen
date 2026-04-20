import { motion } from "framer-motion";
import { Activity, ShieldCheck, TrendingUp, AlertTriangle, RefreshCw, Calendar } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
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

// ── Sub-Components ───────────────────────────────────────────────────────────

const TotalActivityCard = ({ stats, loading }: { stats: DashboardStats; loading: boolean }) => (
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
      <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-1 rounded-full font-semibold border border-white/10">Sepanjang Masa</span>
    </div>
    <div className="mt-5">
      <div className="text-6xl font-black tracking-tighter text-white tabular-nums">
        {loading ? <span className="text-gray-600 animate-pulse">—</span> : stats.totalActivity}
      </div>
      <p className="text-xs text-gray-500 mt-1 font-medium">Total aktivitas fraud scan</p>
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
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Logistics Trust Score</span>
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
          <span className="text-xs text-gray-500 mt-1">/ 1000 Poin</span>
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
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Pendapatan Valid</span>
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
          <TrendingUp className="w-3 h-3" />Dihitung dari {stats.verifiedDocuments + stats.processingDocuments + stats.tamperedDocuments} dokumen (verified + processing + tampered)
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

const WeeklyUsageChart = ({ weeklyData, loading }: { weeklyData: any[]; loading: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
    className="border border-white/10 rounded-xl p-6 bg-[#111]"
  >
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-bold text-white">Weekly Usage</h3>
      <span className="text-xs text-gray-400 px-3 py-1 border border-white/10 rounded-full">Reset setiap Minggu</span>
    </div>

    {loading ? (
      <div className="h-64 flex items-center justify-center border border-white/5 rounded-lg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Memuat data...</p>
        </div>
      </div>
    ) : weeklyData.some((d: any) => (d.scans || 0) > 0) ? (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={{ stroke: '#222' }} tickLine={false} dy={10} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#ffffff05' }}
              contentStyle={{ border: '1px solid #333', backgroundColor: '#000', borderRadius: '8px', color: '#fff' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            />
            <Bar dataKey="scans" name="Fraud Scans" radius={[4, 4, 0, 0]} barSize={40} fill="#fff" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
        <div className="text-center">
          <Activity className="w-12 h-12 text-gray-800 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Belum ada aktivitas minggu ini</p>
          <p className="text-xs text-gray-600 mt-1">Mulai gunakan fitur untuk melihat statistik</p>
        </div>
      </div>
    )}

    <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-white" />
        <span className="text-xs text-gray-500">Fraud Scans</span>
      </div>
    </div>
  </motion.div>
);

const CleanupCard = ({ stats, loading }: { stats: DashboardStats; loading: boolean }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="border border-white/10 rounded-xl p-6 bg-[#111]">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10">
        <AlertTriangle className="w-6 h-6 text-yellow-500" />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-white mb-2">Pembersihan Bulanan</h3>
        <p className="text-sm text-gray-400 mb-3">Data fraud dan ImageKit dihapus otomatis setiap bulan untuk menghemat storage.</p>
        <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
          <div><span className="text-gray-500">Next cleanup:</span><span className="ml-2 font-bold text-white">{loading ? "..." : `${stats.nextCleanupDays} hari`}</span></div>
          <div className="h-4 w-px bg-white/10" />
          <div><span className="text-gray-500">Tanggal:</span><span className="ml-2 font-mono text-white">{loading ? "..." : stats.nextCleanupDate || "Loading..."}</span></div>
        </div>
      </div>
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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const isMounted = useRef(true);
  const yearPickerRef = useRef<HTMLDivElement>(null);

  // Close year picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (yearPickerRef.current && !yearPickerRef.current.contains(e.target as Node)) {
        setShowYearPicker(false);
      }
    };
    if (showYearPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showYearPicker]);

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
    try {
      if (!silent) setLoading(true);
      if (!isMounted.current) return;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { toast.error("Anda harus login terlebih dahulu"); setLoading(false); return; }
      const userId = session.user.id;

      // 1. Status counts from fraud_scans (single source of truth — includes both Web and Telegram)
      const fraudQuery = supabase.from("fraud_scans").select("status, created_at, nominal_total").eq("user_id", userId);
      if (selectedYear) {
        fraudQuery.gte("created_at", `${selectedYear}-01-01T00:00:00`).lte("created_at", `${selectedYear}-12-31T23:59:59`);
      }
      const { data: allFraud } = await fraudQuery;
      let verified = 0, tampered = 0, processing = 0;
      (allFraud || []).forEach((f: any) => {
        if (f.status === "verified") verified++;
        else if (f.status === "tampered") tampered++;
        else if (f.status === "processing") processing++;
      });

      // 2. Trust Score — calculated from document statuses
      // verified=100pts, processing=50pts, tampered=50pts, max 1000
      let calculatedTrustScore = 0;
      try {
        const { data: scoreData, error: scoreError } = await supabase.rpc("calculate_logistics_trust_score", { p_user_id: userId });
        if (scoreError) throw scoreError;
        calculatedTrustScore = scoreData || 0;
      } catch {
        // Fallback: calculate locally if RPC fails
        const totalDocs = verified + processing + tampered;
        if (totalDocs > 0) {
          const rawScore = (verified * 100 + processing * 50 + tampered * 50) / totalDocs;
          calculatedTrustScore = Math.min(Math.round(rawScore * 10), 1000);
        }
      }

      // 3. Revenue — sum nominal_total from fraud_scans directly (covers both Web + Telegram)
      const totalVerif = (allFraud || []).reduce((sum: number, f: any) => sum + Number(f.nominal_total || 0), 0);

      // 4. Credits
      let credits = 0;
      try {
        const creditsRes = await fetch(`${API_URL}/api/users/credits`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (creditsRes.ok) { credits = (await creditsRes.json()).credits ?? 0; }
      } catch { const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single(); credits = profile?.credits ?? 0; }

      // 5. Next cleanup
      const now = new Date();
      const joinDate = session?.user?.created_at ? new Date(session.user.created_at) : now;
      let nextCleanupDate = new Date(now.getFullYear(), now.getMonth(), joinDate.getDate());
      if (nextCleanupDate <= now) nextCleanupDate = new Date(now.getFullYear(), now.getMonth() + 1, joinDate.getDate());
      const nextCleanupDays = Math.ceil((nextCleanupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const nextCleanupDateStr = nextCleanupDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

      // 6. Weekly usage + total activity from fraud_scans (includes Telegram scans)
      const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const dayOfWeek = now.getDay();
      const monday = new Date(now); monday.setDate(now.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)); monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
      const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
      let totalScanFraud = 0;

      // Re-use allFraud data (already fetched for status counts)
      (allFraud || []).forEach((s: any) => {
        const status = s.status || "processing";
        const validStatuses = ['verified', 'processing', 'tampered'];
        if (!validStatuses.includes(status)) return;
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
      const totalActivity = totalScanFraud;

      // 8. Cleanup API override
      let apiCleanupDays = nextCleanupDays, apiCleanupDate = nextCleanupDateStr;
      try {
        const cleanupRes = await fetch(`${API_URL}/api/cleanup/cleanup-stats`);
        if (cleanupRes.ok) {
          const c = await cleanupRes.json();
          apiCleanupDays = c.days_until_cleanup ?? nextCleanupDays;
          apiCleanupDate = c.next_cleanup_date ? new Date(c.next_cleanup_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : nextCleanupDateStr;
        }
      } catch (e) { console.error('Could not fetch cleanup stats:', e); }

      if (isMounted.current) {
        setStats({
          trustScore: calculatedTrustScore, totalNominalVerified: totalVerif, totalDocuments: (allFraud || []).length,
          verifiedDocuments: verified, tamperedDocuments: tampered, processingDocuments: processing,
          totalActivity, totalScanFraud,
          credits, nextCleanupDays: apiCleanupDays, nextCleanupDate: apiCleanupDate,
        });
        setLoading(false);
      }
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) return;
      console.error("Dashboard fetch error:", error);
      if (isMounted.current) setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    isMounted.current = true;
    let subscription: ReturnType<typeof supabase.channel>;
    let realtimePoll: ReturnType<typeof setInterval> | undefined;

    const setupDashboard = async () => {
      await fetchDashboardData();
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` }, () => { if (isMounted.current) fetchDashboardData(true); })
        .subscribe();

      // Fallback realtime polling in case websocket/realtime channel drops.
      realtimePoll = setInterval(() => {
        if (isMounted.current) fetchDashboardData(true);
      }, 10000);
    };
    setupDashboard();

    const handleScanCompleted = () => { if (isMounted.current) fetchDashboardData(true); };
    window.addEventListener('scan-completed', handleScanCompleted);

    return () => {
      isMounted.current = false;
      window.removeEventListener('scan-completed', handleScanCompleted);
      if (realtimePoll) clearInterval(realtimePoll);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [fetchDashboardData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 space-y-6 text-white font-sans pb-32">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="border-b border-white/10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Monitor aktivitas dan performa finansial Anda</p>
          </div>
          <div className="relative" ref={yearPickerRef}>
            <button
              onClick={() => setShowYearPicker(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-full font-medium transition-all border ${
                selectedYear ? 'bg-white text-black border-white' : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {selectedYear || 'Semua Tahun'}
            </button>
            {showYearPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-[#111] border border-white/10 rounded-xl p-3 shadow-2xl w-[220px] max-h-[280px] overflow-y-auto">
                <button
                  onClick={() => { setSelectedYear(null); setShowYearPicker(false); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    !selectedYear ? 'bg-white text-black font-bold' : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Semua Tahun
                </button>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {Array.from({ length: 25 }, (_, i) => 2026 + i).map(yr => (
                    <button
                      key={yr}
                      onClick={() => { setSelectedYear(yr); setShowYearPicker(false); }}
                      className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all ${
                        selectedYear === yr ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

      {/* Weekly Usage Chart */}
      <WeeklyUsageChart weeklyData={weeklyData} loading={loading} />

      {/* Info Cards */}
      <CleanupCard stats={stats} loading={loading} />
      <SecurityInfoCard />
    </div>
  );
};

export default DashboardTab;
