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

  // --- 1. SETUP & FETCH DATA (FIXED) ---
  const fetchUserProfile = async () => {
    try {
        // 🔥 GANTI KE localStorage (Biar buka tab baru tetep login)
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) { navigate('/landing'); return; }

        const localUser = JSON.parse(storedUser);
        const token = localUser?.credential;
        
        if (!token) { navigate('/landing'); return; }

        // Set UI awal pakai data lokal dulu (Optimistic UI)
        setUser(localUser);

        // 🔥 FETCH DATA REALTIME DARI SERVER
        const profileRes = await apiFetch("/me", { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        
        if (profileRes.ok) {
            const profileJson = await profileRes.json();
            if (profileJson && profileJson.status === "success") {
                // 🔥 UPDATE CREDIT BALANCE LANGSUNG!
                // Gabungkan data lokal dengan data server yang lebih baru
                const updatedUser = { 
                    ...localUser, 
                    ...profileJson.data,
                    // Paksa update kredit dari server
                    creditBalance: profileJson.data.creditBalance 
                };
                
                // Update State React & LocalStorage
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        } 

        // Fetch History Log
        const historyRes = await apiFetch("/history", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (historyRes.ok) {
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
        }
    } catch (e) {
        console.error("Sync Error:", e);
    } finally {
        setInitLoading(false);
    }
  };

  useEffect(() => { fetchUserProfile(); }, []);

  // --- 2. LOGIKA SCAN ---
  const handleScan = async (file: File) => {
    if (!user) return;
    if (user.creditBalance < 1) {
        toast.error("Kredit Habis!", { description: "Reset otomatis besok." });
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

      if (!res.ok) {
         const errJson = await res.json().catch(() => null); 
         throw new Error(errJson?.message || "Gagal memproses.");
      }

      const json = await res.json();

      if (json && json.status === "success") {
        toast.success("Berhasil!");
        
        // Update Kredit Realtime
        const newBalance = json.remaining_credits;
        setUser((prevUser: any) => {
            const updated = { ...prevUser, creditBalance: newBalance };
            localStorage.setItem('user', JSON.stringify(updated)); // Update Storage juga
            return updated;
        });

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
        throw new Error(json?.message || "Gagal memproses data.");
      }
    } catch (error: any) {
      toast.error("Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // ... (Sisa fungsi handleDeleteLog & handleUpdateLog biarkan sama seperti sebelumnya)
  // Pastikan pakai apiFetch & user.credential
  const handleDeleteLog = async (id: number) => { /* Code lama */ };
  const handleUpdateLog = async (id: number, summary: string) => { /* Code lama */ };
  
  // Karena kode panjang, bagian return UI di bawah ini SAMA PERSIS kayak kode sebelumnya.
  // Cuma pastikan di Header onLogout panggil localStorage.clear()

  if (initLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]"><div className="animate-spin text-2xl">⏳</div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 font-sans text-[#1A1A1A] dark:text-white pb-20">
      <Header 
        user={user} 
        onLogout={() => { localStorage.clear(); navigate('/landing'); }} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => navigate('/settings')} 
      />
      {/* ... Sisa Tampilan Dashboard Sama ... */}
      <main className="container mx-auto px-4 py-6 max-w-5xl flex flex-col gap-6">
        {/* ... Copy paste UI dashboard kamu ... */}
         <div className="w-full text-left">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Halo, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Siap mendigitalkan dokumen?</p>
        </div>
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
             <FileUploadZone onFileSelect={handleScan} />
        </div>
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
             <DataTable logs={logs} onDeleteLog={handleDeleteLog} onUpdateLog={handleUpdateLog} />
        </div>
      </main>
    </div>
  );
}
