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

  // FETCH PROFILE & DATA
  const fetchUserProfile = async () => {
    try {
        const storedUser = sessionStorage.getItem('user');
        const localUser = storedUser ? JSON.parse(storedUser) : null;
        const token = localUser?.credential;
        
        if (!token) { navigate('/login'); return; }

        // Fetch User Info (Credit, Name, dll)
        const profileRes = await apiFetch("/me", { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
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

        // Fetch Logs (History)
        const historyRes = await apiFetch("/history", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const historyData = await historyRes.json();
        if (Array.isArray(historyData)) {
            const formattedLogs = historyData.map((item: any) => ({
                id: item.id,
                date: item.timestamp.split("T")[0],
                time: new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
                docType: item.kategori,
                summary: item.summary,
                receiver: item.receiver,
                imageUrl: item.imagePath
            }));
            setLogs(formattedLogs);
        }

    } catch (e) {
        console.error("Gagal sync data (mungkin DB mati):", e);
    } finally {
        setInitLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [navigate]);

  const handleScan = async (file: File) => {
    if (!user) return;
    if (user.creditBalance < 1) {
        toast.error("Kredit Habis!", { description: "Tunggu besok ya, reset jam 00:00." });
        return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", user.name || "User");

    try {
      toast.info("Memproses...", { description: "AI sedang membaca dokumen..." });
      
      const res = await apiFetch("/scan", {
        method: "POST",
        body: formData,
        headers: { "Authorization": `Bearer ${user.credential}` },
        timeout: 90000 
      });

      const json = await res.json();

      if (json.status === "success") {
        toast.success("Berhasil!");
        
        // REALTIME UPDATE CREDIT
        const newBalance = json.remaining_credits;
        setUser((prevUser: any) => {
            const updated = { ...prevUser, creditBalance: newBalance };
            sessionStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });

        // UPDATE LOGS DI TABEL
        const newLog = {
            id: json.data.id,
            date: new Date().toISOString().split("T")[0],
            time: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
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
        await apiFetch(`/logs/${id}`, { 
            method: "DELETE",
            headers: { "Authorization": `Bearer ${user.credential}` }
        });
        setLogs(prev => prev.filter(l => l.id !== id));
        toast.success("Data dihapus.");
    } catch (e) { toast.error("Gagal menghapus."); }
  };

  const handleUpdateLog = async (id: number, summary: string) => {
    try {
        await apiFetch(`/logs/${id}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${user.credential}`
            },
            body: JSON.stringify({ summary })
        });
        setLogs(prev => prev.map(l => l.id === id ? { ...l, summary } : l));
        toast.success("Tersimpan.");
    } catch (e) { toast.error("Gagal menyimpan."); }
  };

  if (initLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]"><div className="animate-spin text-2xl">⏳</div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white pb-20">
      <Header 
        user={user} 
        onLogout={() => { sessionStorage.clear(); navigate('/landing'); }} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => navigate('/settings')} 
      />

      {/* 🔥 FIX LAYOUT: Flex Column biar numpuk ke bawah di HP */}
      <main className="container mx-auto px-4 py-6 max-w-5xl flex flex-col gap-6">
        
        {/* SECTION 1: WELCOME */}
        <div className="w-full text-left">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Halo, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Siap mendigitalkan dokumen?</p>
        </div>

        {/* SECTION 2: INPUT ZONE (Card Putih Lebar) */}
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
                 <h2 className="font-bold text-lg">Input Dokumen</h2>
                 {loading && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">Memproses...</span>}
            </div>
            {/* Wrapper Upload Zone */}
            <div className="w-full">
                <FileUploadZone onFileSelect={handleScan} />
            </div>
        </div>

        {/* SECTION 3: DATA TABLE (Fix Scroll) */}
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="mb-4">
                <h2 className="font-bold text-lg">Riwayat Digitalisasi</h2>
            </div>
            {/* Wrapper Scroll Horizontal untuk HP */}
            <div className="w-full overflow-x-auto">
                 <div className="min-w-[600px]"> {/* Paksa lebar min agar tabel tidak gepeng */}
                    <DataTable 
                        logs={logs} 
                        onDeleteLog={handleDeleteLog} 
                        onUpdateLog={handleUpdateLog} 
                    />
                 </div>
            </div>
        </div>
      </main>
    </div>
  );
}
