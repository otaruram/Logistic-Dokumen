import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import { LayoutDashboard, FileText, Zap } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  
  // State Utama
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");

  // Fungsi Refresh Data (Dipanggil saat pertama loading & setelah scan sukses)
  const refreshData = async () => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        apiFetch("/me"),
        apiFetch("/history")
      ]);

      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.status === "success") setUser(profileJson.data);
      }

      if (historyRes.ok) {
        const historyJson = await historyRes.json();
        setLogs(Array.isArray(historyJson) ? historyJson : []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Handler Logout
  const handleLogout = () => {
    localStorage.clear();
    toast.success("Berhasil keluar.");
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">
          Loading OCR.wtf...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans pb-20">
      
      {/* HEADER: Menampilkan Kredit & Info Reset */}
      <Header 
        user={user} 
        onLogout={handleLogout} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => setActiveView("settings")}
      />

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        
        {activeView === "dashboard" ? (
          <>
            {/* SUMMARY STATS (GAYA SIMPEL/REPLIZ) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Scanned</span>
                </div>
                <p className="text-4xl font-black">{logs.length}</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Zap className="w-4 h-4 fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Credit Active</span>
                </div>
                <p className="text-4xl font-black">{user?.creditBalance ?? 0}</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02] flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Status Sistem</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-sm font-bold text-emerald-600 uppercase">Online</span>
                </div>
              </div>
            </div>

            {/* AREA UPLOAD */}
            <div className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 px-2">Action Center</h2>
              <FileUploadZone onUploadSuccess={refreshData} />
            </div>

            {/* TABEL DATA */}
            <div className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 px-2">Recent Database</h2>
              <DataTable logs={logs} user={user} />
            </div>
          </>
        ) : (
          /* SIMPLE SETTINGS VIEW */
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800 shadow-sm max-w-md mx-auto">
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5" /> Settings
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Versi Aplikasi</p>
                <p className="text-sm font-bold">OCR.WTF Pipeline v2.1</p>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Status Cloud</p>
                <p className="text-sm font-bold text-emerald-600 uppercase">Terhubung</p>
              </div>
              <button 
                onClick={() => setActiveView("dashboard")}
                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-sm transition-transform active:scale-95"
              >
                KEMBALI KE DASHBOARD
              </button>
            </div>
          </div>
        )}

      </main>

      <p className="text-center text-[10px] font-bold text-zinc-300 dark:text-zinc-800 uppercase tracking-[0.3em] mt-10">
        Build with SmartDoc Technology
      </p>
    </div>
  );
}
