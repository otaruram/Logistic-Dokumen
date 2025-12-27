import { motion } from "framer-motion";
import { Activity, Coins, AlertTriangle, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DashboardTab = () => {
  const [stats, setStats] = useState({
    totalActivities: 0,
    credits: 10,
    maxCredits: 10,
    nextCleanupDays: 7,
    nextCleanupDate: ""
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        toast.error("Anda harus login terlebih dahulu");
        setLoading(false);
        return;
      }

      // Fetch stats
      const statsRes = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch weekly data
      const weeklyRes = await fetch(`${API_URL}/api/dashboard/weekly`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (weeklyRes.ok) {
        const weeklyData = await weeklyRes.json();
        setWeeklyData(weeklyData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      toast.error("Gagal memuat data dashboard");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 space-y-6 text-white font-sans">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/10 pb-4"
      >
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Monitor aktivitas dan penggunaan Anda</p>
      </motion.div>

      {/* Stats Grid - Premium Dark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Activities Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-white/10 rounded-xl p-6 bg-[#111] hover:bg-[#161616] transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-white" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Total Aktivitas
                </span>
              </div>
              <div className="text-4xl font-bold text-white mb-1">
                {loading ? "..." : stats.totalActivities}
              </div>
              <p className="text-xs text-gray-500">Aktivitas minggu ini</p>
            </div>
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>

        {/* Credits Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-white/10 rounded-xl p-6 bg-white text-black transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-black" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Credits
                </span>
              </div>
              <div className="text-4xl font-bold text-black mb-1">
                {loading ? "..." : stats.credits}
                <span className="text-lg text-gray-500 font-normal">/{stats.maxCredits}</span>
              </div>
              <p className="text-xs text-gray-500">Reset setiap hari jam 00:00</p>
            </div>
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
              <Coins className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Weekly Cleanup Warning - Premium Dark */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="border border-white/10 rounded-xl p-6 bg-[#111]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Pembersihan Bulanan</h3>
            <p className="text-sm text-gray-400 mb-3">
              Data DGTNZ & ImageKit dihapus otomatis setiap bulan untuk menghemat storage.
            </p>
            <div className="flex items-center gap-4 text-sm">
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
        ) : weeklyData && weeklyData.length > 0 ? (
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
            Menghitung: <span className="font-medium text-white">SCAN DOCUMENT</span>
          </p>
        </div>
      </motion.div>

      {/* Info Banner - Clean & Simple */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="border border-white/10 rounded-xl p-6 bg-[#111]"
      >
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-white flex items-center justify-center flex-shrink-0 rounded-full mt-0.5">
              <span className="text-black text-xs font-bold">!</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-1">Gratis Selamanya</h4>
              <p className="text-sm text-gray-400">
                Credits direset otomatis setiap hari jam <strong>00:00</strong>.
                Data DGTNZ dihapus setiap <strong>30 hari</strong>.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardTab;
