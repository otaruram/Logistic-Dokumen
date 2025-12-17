import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-service";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // Fungsi Fetch Profile (Dipisah agar bisa dipanggil ulang)
  const fetchUserProfile = async () => {
    try {
        const storedUser = sessionStorage.getItem('user');
        const localUser = storedUser ? JSON.parse(storedUser) : null;

        const profileRes = await apiFetch("/me");
        const profileJson = await profileRes.json();
        
        if (profileJson.status === "success") {
            const updatedUser = { ...(localUser || {}), ...profileJson.data };
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
        } else if (localUser) {
            setUser(localUser);
        } else {
            navigate('/landing');
        }
    } catch (e) {
        console.error("Gagal sync profile:", e);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchUserProfile(); // Load User

        // Load History
        const historyRes = await apiFetch("/history");
        const historyData = await historyRes.json();
        if (Array.isArray(historyData)) {
            const formattedLogs = historyData.map((item: any) => ({
                id: item.id,
                date: item.timestamp.split("T")[0],
                time: new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                docType: item.kategori,
                summary: item.summary,
                receiver: item.receiver,
                imageUrl: item.imagePath
            }));
            setLogs(formattedLogs);
        }
      } catch (error) {
        console.error("Gagal load data:", error);
      } finally {
        setInitLoading(false);
      }
    };
    loadData();
  }, [navigate]);

  const handleScan = async (file: File) => {
    if (!user) return;
    if (user.creditBalance < 1) {
        toast.error("Kredit Habis!", { description: "Kuota harian Anda telah habis." });
        return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", user.name || "User");

    try {
      toast.info("Memproses Dokumen...", { description: "AI sedang membaca teks & validasi..." });
      
      const res = await apiFetch("/scan", {
        method: "POST",
        body: formData,
        timeout: 90000 
      });

      const json = await res.json();

      if (json.status === "success") {
        toast.success("Selesai!", { description: "Dokumen berhasil didigitalkan." });
        
        // 🔥 UPDATE USER STATE SECARA LANGSUNG (REALTIME UPDATE)
        const newBalance = json.remaining_credits;
        
        // Kita update state 'user' dengan balance baru
        setUser((prevUser: any) => {
            const updated = { ...prevUser, creditBalance: newBalance };
            sessionStorage.setItem('user', JSON.stringify(updated)); // Update Storage juga
            return updated;
        });

        // Update Tabel Log
        const newLog = {
            id: json.data.id,
            date: new Date().toISOString().split("T")[0],
            time: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            docType: json.data.kategori,
            summary: json.data.summary,
            receiver: user.name,
            imageUrl: json.data.imagePath
        };
        setLogs(prev => [newLog, ...prev]);

      } else {
        throw new Error(json.message || "Gagal memproses gambar");
      }
    } catch (error: any) {
      toast.error("Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    if(!confirm("Hapus data ini?")) return;
    try {
        await apiFetch(`/logs/${id}`, { method: "DELETE" });
        setLogs(prev => prev.filter(l => l.id !== id));
        toast.success("Data dihapus.");
    } catch (e) { toast.error("Gagal menghapus."); }
  };

  const handleUpdateLog = async (id: number, summary: string) => {
    try {
        await apiFetch(`/logs/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summary })
        });
        setLogs(prev => prev.map(l => l.id === id ? { ...l, summary } : l));
        toast.success("Ringkasan diperbarui.");
    } catch (e) { toast.error("Gagal menyimpan."); }
  };

  if (initLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]"><div className="animate-spin text-2xl">⏳</div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white pb-20">
      
      {/* 🔥 HEADER MENDAPATKAN PROP USER YG SELALU UPDATE */}
      <Header 
        user={user} 
        onLogout={() => { sessionStorage.clear(); navigate('/landing'); }} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => navigate('/settings')} 
      />

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* SECTION 1: WELCOME */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Halo, {user?.name?.split(" ")[0]} 👋</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Siap mendigitalkan dokumen hari ini?</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 px-5 py-2.5 rounded-full shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Sisa Kredit</span>
                <span className="text-xl font-bold text-black dark:text-white transition-all duration-300 transform key={user?.creditBalance}">
                    {user?.creditBalance}
                </span>
            </div>
        </div>

        {/* SECTION 2: INPUT ZONE */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-6">
                 <h2 className="font-bold text-lg">Input Dokumen</h2>
                 {loading && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">Sedang Memproses AI...</span>}
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-zinc-800">
                <FileUploadZone onFileSelect={handleScan} />
            </div>
        </div>

        {/* SECTION 3: HISTORY TABLE */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="mb-6">
                <h2 className="font-bold text-lg">Riwayat Digitalisasi</h2>
                <p className="text-sm text-gray-500">Semua dokumen yang telah diproses.</p>
            </div>
            <div className="overflow-hidden rounded-xl">
                 <DataTable 
                    logs={logs} 
                    onDeleteLog={handleDeleteLog} 
                    onUpdateLog={handleUpdateLog} 
                />
            </div>
        </div>
      </main>
    </div>
  );
}
