import { motion } from "framer-motion";
import { Activity, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const DashboardTab = () => {
  const [stats, setStats] = useState({
    trustScore: 0,
    totalNominalVerified: 0,
    totalDocuments: 0,
    verifiedDocuments: 0,
    tamperedDocuments: 0,
    processingDocuments: 0,
    // Activity Stats
    totalActivity: 0,
    totalScanDefault: 0,
    totalScanFraud: 0,
    credits: 0,
    nextCleanupDays: 0,
    nextCleanupDate: "",
  });

  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  // Wrap fetchDashboardData in useCallback so it can be referenced in useEffect
  const fetchDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      if (!isMounted.current) return;
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        toast.error("Anda harus login terlebih dahulu");
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // 1. Ambil Logistics Trust Score via RPC function
      const { data: scoreData, error: scoreError } = await supabase.rpc(
        "calculate_logistics_trust_score",
        { p_user_id: userId },
      );
      if (scoreError) console.error("Error fetching score:", scoreError);

      // 2. Query Agregasi untuk Total Pendapatan Valid (Verified)
      const { data: financeData, error: financeError } = await supabase
        .from("extracted_finance_data")
        .select("nominal_amount")
        .eq("user_id", userId);
      if (financeError) console.error("Error fetching finance data:", financeError);

      const totalVerif = financeData
        ? financeData.reduce((sum, item) => sum + Number(item.nominal_amount), 0)
        : 0;

      // 3. Query hitung status dokumen (Verified, Tampered, Processing)
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("status")
        .eq("user_id", userId);
      if (docsError) console.error("Error fetching documents:", docsError);

      let verified = 0;
      let tampered = 0;
      let processing = 0;
      if (docs) {
        docs.forEach((doc) => {
          if (doc.status === "verified") verified++;
          if (doc.status === "tampered") tampered++;
          if (doc.status === "processing") processing++;
        });
      }

      // 4. Credits from backend API (reads from Supabase profiles - source of truth)
      let credits = 0;
      try {
        const creditsRes = await fetch(`${API_URL}/api/users/credits`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          credits = creditsData.credits ?? 0;
        }
      } catch (e) {
        console.error('Error fetching credits from API:', e);
        // Fallback: try Supabase direct query
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single();
        credits = profile?.credits ?? 0;
      }

      // 5. Next cleanup based on user's JOIN DATE anniversary
      const now = new Date();
      const joinDate = session?.user?.created_at ? new Date(session.user.created_at) : now;
      const joinDay = joinDate.getDate();
      let nextCleanupDate = new Date(now.getFullYear(), now.getMonth(), joinDay);
      if (nextCleanupDate <= now) {
        nextCleanupDate = new Date(now.getFullYear(), now.getMonth() + 1, joinDay);
      }
      const diffTime = nextCleanupDate.getTime() - now.getTime();
      const nextCleanupDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const nextCleanupDateStr = nextCleanupDate.toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      // 6. Weekly Usage: current week (Mon-Sun) from scans API (default + fraud)
      const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const todayDate = new Date(now);
      // Get Monday of current week
      const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(todayDate);
      monday.setDate(todayDate.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // 6+7. Fetch scans ONCE — build weekly chart + count activity
      const dailyCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      let totalScanDefault = 0;
      let totalScanFraud = 0;
      try {
        const scansRes = await fetch(`${API_URL}/api/scans`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        if (scansRes.ok) {
          const scansData: Array<{ status: string; created_at: string; is_fraud_scan: boolean }> = await scansRes.json();
          scansData.forEach(s => {
            if (s.status === 'completed') {
              // Activity count
              if (s.is_fraud_scan) totalScanFraud++;
              else totalScanDefault++;
              // Weekly chart
              if (s.created_at) {
                const scanDate = new Date(s.created_at);
                if (scanDate >= monday && scanDate <= sunday) {
                  const scanDay = scanDate.getDay();
                  const idx = scanDay === 0 ? 6 : scanDay - 1;
                  dailyCounts[idx]++;
                }
              }
            }
          });
        }
      } catch (e) {
        console.error('Could not fetch scans:', e);
      }
      const weeklyChartData = dayNames.map((label, i) => ({ day: label, count: dailyCounts[i] }));
      if (isMounted.current) setWeeklyData(weeklyChartData);
      const totalActivity = totalScanDefault + totalScanFraud;

      // 8. Cleanup stats from API
      let apiCleanupDays = nextCleanupDays;
      let apiCleanupDate = nextCleanupDateStr;
      try {
        const cleanupRes = await fetch(`${API_URL}/api/cleanup/cleanup-stats`);
        if (cleanupRes.ok) {
          const cleanupData = await cleanupRes.json();
          apiCleanupDays = cleanupData.days_until_cleanup ?? nextCleanupDays;
          apiCleanupDate = cleanupData.next_cleanup_date
            ? new Date(cleanupData.next_cleanup_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
            : nextCleanupDateStr;
        }
      } catch (e) {
        console.error('Could not fetch cleanup stats:', e);
      }

      // Update State
      if (isMounted.current) {
        setStats({
          trustScore: scoreData || 0,
          totalNominalVerified: totalVerif,
          totalDocuments: docs?.length || 0,
          verifiedDocuments: verified,
          tamperedDocuments: tampered,
          processingDocuments: processing,
          totalActivity,
          totalScanDefault,
          totalScanFraud,
          credits,
          nextCleanupDays: apiCleanupDays,
          nextCleanupDate: apiCleanupDate,
        });
        setLoading(false);
      }
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) return;
      console.error("Dashboard fetch error:", error);
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    let subscription: ReturnType<typeof supabase.channel>;

    const setupDashboard = async () => {
      await fetchDashboardData();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // Enable Realtime Subscriptions
      subscription = supabase
        .channel('dashboard-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            const newData = payload.new as Record<string, unknown>;
            if (newData && typeof newData.credits === 'number' && isMounted.current) {
              setStats((prev) => ({ ...prev, credits: newData.credits as number }));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${userId}` },
          () => {
            if (isMounted.current) fetchDashboardData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'extracted_finance_data', filter: `user_id=eq.${userId}` },
          () => {
            if (isMounted.current) fetchDashboardData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` },
          () => {
            if (isMounted.current) fetchDashboardData(true);
          }
        )
        .subscribe();
    };

    setupDashboard();

    // Listen for scan-completed events from DgtnzTab
    const handleScanCompleted = () => {
      if (isMounted.current) fetchDashboardData(true);
    };
    window.addEventListener('scan-completed', handleScanCompleted);

    return () => {
      isMounted.current = false;
      window.removeEventListener('scan-completed', handleScanCompleted);
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [fetchDashboardData]);

  // Helpers for Gauge Chart
  const SCORE_MAX = 1000;
  const currentScore = stats.trustScore;
  const data = [
    { name: "Score", value: currentScore },
    { name: "Remaining", value: SCORE_MAX - currentScore },
  ];

  // Calculate Color based on Score Tier
  const getScoreColor = (score: number) => {
    if (score >= 800) return "#10b981"; // Excellent (Green)
    if (score >= 500) return "#f59e0b"; // Good (Yellow)
    if (score >= 300) return "#f97316"; // Fair (Orange)
    return "#ef4444"; // Poor (Red)
  };

  const scoreColor = getScoreColor(currentScore);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 space-y-6 text-white font-sans pb-32">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/10 pb-4"
      >
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Monitor aktivitas dan performa finansial Anda
        </p>
      </motion.div>

      {/* Top Banner Grid (Old UI: Activity & Credits) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── TOTAL AKTIVITAS CARD ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-white/10 rounded-2xl p-6 bg-gradient-to-br from-[#111] to-[#0d0d0d] flex flex-col justify-between relative overflow-hidden group"
        >
          {/* subtle glow */}
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/5 blur-3xl group-hover:bg-white/8 transition-colors pointer-events-none" />

          {/* header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Aktivitas</span>
            </div>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-1 rounded-full font-semibold border border-white/10">Sepanjang Masa</span>
          </div>

          {/* big number */}
          <div className="mt-5">
            <div className="text-6xl font-black tracking-tighter text-white tabular-nums">
              {loading ? <span className="text-gray-600 animate-pulse">—</span> : stats.totalActivity}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">Scan berhasil diproses</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-white/10 rounded-xl p-6 bg-white flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                <path d="M12 18V6" />
              </svg>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                CREDITS
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="21.17" x2="12" y1="8" y2="8" />
                <line x1="3.95" x2="8.54" y1="6.06" y2="14" />
                <line x1="10.88" x2="15.46" y1="21.94" y2="14" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-black tracking-tighter text-black flex items-baseline gap-1">
              {loading ? "..." : stats.credits}
              <span className="text-xl text-gray-400 font-bold">/10</span>
            </div>
            <p className="text-xs text-gray-500 mt-2 font-medium">Reset setiap hari jam 00:00</p>
          </div>

          {/* Cost breakdown */}
          <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">DGTNZ Default</p>
              <p className="text-sm font-bold text-black">1 kredit<span className="text-gray-400 font-normal">/scan</span></p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Deteksi Fraud</p>
              <p className="text-sm font-bold text-black">1 kredit<span className="text-gray-400 font-normal">/scan</span></p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logistics Trust Score Gauge Widget */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-white/10 rounded-xl p-6 bg-[#111] hover:bg-[#161616] transition-all flex flex-col items-center justify-center relative overflow-hidden"
        >
          {/* Background Glow */}
          <div
            className="absolute -top-10 flex w-full justify-center opacity-20 blur-2xl pointer-events-none"
            style={{
              backgroundColor: scoreColor,
              width: "150px",
              height: "150px",
              borderRadius: "50%",
            }}
          />

          <div className="w-full flex items-start justify-between mb-2 z-10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" style={{ color: scoreColor }} />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Logistics Trust Score
              </span>
            </div>
            {currentScore >= 800 && (
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                EXCELLENT
              </span>
            )}
          </div>

          <div className="h-48 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="70%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell key="cell-0" fill={scoreColor} />
                  <Cell key="cell-1" fill="#222" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Score Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 pointer-events-none">
              <span
                className="text-5xl font-bold text-white tracking-tighter shadow-sm"
                style={{ textShadow: `0 0 20px ${scoreColor}40` }}
              >
                {loading ? "..." : currentScore}
              </span>
              <span className="text-xs text-gray-500 mt-1">/ 1000 Poin</span>
            </div>
          </div>
        </motion.div>

        {/* Total Nominal Verified Widget */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-white/10 rounded-xl p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-gray-300" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Total Pendapatan Valid
                </span>
              </div>
              <div className="text-3xl font-bold text-white mb-2 tracking-tight">
                {loading ? "..." : formatCurrency(stats.totalNominalVerified)}
              </div>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Dihitung dari {stats.verifiedDocuments} dokumen tervalidasi
              </p>
            </div>
          </div>

          {/* Mini Document Status breakdown */}
          <div className="mt-8 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center relative z-10">
            <div>
              <div className="text-lg font-bold text-white">
                {stats.verifiedDocuments}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">
                Verified
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-500">
                {stats.processingDocuments}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">
                Processing
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-500">
                {stats.tamperedDocuments}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">
                Tampered
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Weekly Usage Chart - Premium Dark */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="border border-white/10 rounded-xl p-6 bg-[#111]"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Weekly Usage</h3>
          <span className="text-xs text-gray-400 px-3 py-1 border border-white/10 rounded-full">
            Reset setiap Minggu
          </span>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center border border-white/5 rounded-lg">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Memuat data...</p>
            </div>
          </div>
        ) : weeklyData.some(d => d.count > 0) ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#222' }}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{
                    border: '1px solid #333',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={40}>
                  {weeklyData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.count > 0 ? '#fff' : '#222'}
                    />
                  ))}
                </Bar>
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

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-500">
            Menghitung: <span className="font-medium text-white">DGTNZ Default + Deteksi Fraud</span>
          </p>
        </div>
      </motion.div>

      {/* Storage Warning Alert */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="border border-white/10 rounded-xl p-6 bg-[#111]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Pembersihan Bulanan</h3>
            <p className="text-sm text-gray-400 mb-3">
              Data DGTNZ Default & Fraud + ImageKit dihapus otomatis setiap bulan untuk menghemat storage.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-500">Next cleanup:</span>
                <span className="ml-2 font-bold text-white">
                  {loading ? "..." : `${stats.nextCleanupDays} hari`}
                </span>
              </div>
              <div className="h-4 w-px bg-white/10"></div>
              <div>
                <span className="text-gray-500">Tanggal:</span>
                <span className="ml-2 font-mono text-white">
                  {loading ? "..." : stats.nextCleanupDate || "Loading..."}
                </span>
              </div>
            </div>

          </div>
        </div>
      </motion.div>

      {/* Security Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="border border-white/10 rounded-xl p-6 bg-[#111]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10">
            <ShieldCheck className="w-6 h-6 text-gray-300" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white mb-1">
              Cryptographic Security Active
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Semua dokumen yang diproses menggunakan algoritma Anti-Fraud
              (Digital Signature Hash). Dokumen bertanda{" "}
              <strong className="text-red-400">Tampered</strong> tidak akan
              dihitung ke dalam Total Pendapatan atau skor kredit.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Free Tier Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="border border-white/10 rounded-xl p-6 bg-[#111]"
      >
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-white flex items-center justify-center flex-shrink-0 rounded-full mt-0.5">
              <span className="text-black text-xs font-bold">!</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-1">Gratis Selamanya</h4>
              <p className="text-sm text-gray-400 mb-3">
                Credits direset otomatis setiap hari jam <strong>00:00</strong>.
                Data DGTNZ Default & Fraud dihapus setiap <strong>30 hari</strong>.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Kredit</p>
                  <p className="text-lg font-bold text-white tabular-nums">
                    {loading ? "..." : <>{stats.credits}<span className="text-sm text-gray-500">/10</span></>}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Aktivitas</p>
                  <p className="text-lg font-bold text-white tabular-nums">
                    {loading ? "..." : stats.totalActivity}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Dokumen</p>
                  <p className="text-lg font-bold text-white tabular-nums">
                    {loading ? "..." : stats.totalDocuments}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardTab;
