import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable"; // Pastikan default export di file tujuannya
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ambil Data Profil & History
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          apiFetch("/me"),
          apiFetch("/history")
        ]);

        const profileJson = await profileRes.json();
        if (profileJson.status === "success") {
          setUser(profileJson.data);
        }

        const historyJson = await historyRes.json();
        setLogs(Array.isArray(historyJson) ? historyJson : []);
      } catch (error) {
          toast.error("Koneksi ke server gagal.");
      } finally {
          setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  if (isLoading) return <div className="h-screen flex items-center justify-center font-bold uppercase tracking-widest animate-pulse">Memuat OCR.wtf...</div>;

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-zinc-950 pb-24">
      <Header 
        user={user} 
        onLogout={() => { localStorage.clear(); navigate('/login'); }} 
        onProfile={() => navigate('/profile')} 
      />

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {/* AREA SUMMARY (GAYA REPLIZ) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">Total Digitalized</h3>
                <p className="text-4xl font-black">{logs.length}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">Current Tier</h3>
                <p className="text-4xl font-black uppercase tracking-tighter text-blue-600">Free</p>
            </div>
        </div>

        {/* FITUR SCAN */}
        <FileUploadZone onUploadSuccess={() => window.location.reload()} />

        {/* TABEL DATA DENGAN LINK FOTO */}
        <DataTable logs={logs} user={user} />
      </main>

      {/* Rencana: Pasang BottomNav di sini di langkah redesain berikutnya */}
    </div>
  );
}
