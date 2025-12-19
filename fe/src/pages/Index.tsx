import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api-service";
import Header from "@/components/dashboard/Header";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import DataTable from "@/components/dashboard/DataTable";
import { toast } from "sonner";
import { triggerCreditUpdate, triggerCreditUsage, showCreditWarning } from "@/event"; 
import { FileText, Clock, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // --- FETCH PROFILE & HISTORY ---
  const fetchData = async () => {
    try {
        const stored = localStorage.getItem('user');
        if (!stored) { navigate('/landing'); return; }
        const localUser = JSON.parse(stored);
        const token = localUser?.credential;

        // Sync Profile (Kredit & Reset Info)
        const profileRes = await apiFetch("/me", { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        
        if (profileRes.ok) {
            const json = await profileRes.json();
            if (json.status === "success") {
                const updated = { ...localUser, ...json.data };
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
            }
        } else if (profileRes.status === 401) {
            localStorage.clear(); navigate('/landing'); return;
        }

        // Fetch History
        const historyRes = await apiFetch("/history", { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        if (historyRes.ok) {
            const historyData = await historyRes.json();
            setLogs(historyData.map((item: any) => ({
                id: item.id,
                date: item.timestamp.split("T")[0],
                time: new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }),
                docType: item.kategori,
                summary: item.summary,
                receiver: item.receiver,
                imageUrl: item.imagePath
            })));
        }
    } catch (e) {
        console.error("Sync Error:", e);
    } finally {
        setInitLoading(false);
    }
  };

  useEffect(() => { 
      fetchData();
      window.addEventListener('creditUpdated', fetchData);
      return () => window.removeEventListener('creditUpdated', fetchData);
  }, []);

  // --- LOGIC SCAN ---
  const handleScan = async (file: File) => {
    if (!user || user.creditBalance < 1) { 
        toast.error("Kredit Habis!", { description: "Tunggu reset harian atau upgrade tier." }); 
        return; 
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", user.name || "User");

    try {
      toast.info("AI sedang menganalisis dokumen...");
      const res = await apiFetch("/scan", { 
          method: "POST", 
          body: formData, 
          headers: { "Authorization": `Bearer ${user.credential}` } 
      });
      
      const json = await res.json();
      if (json.status === "success") {
        toast.success("Dokumen berhasil didigitalisasi!");
        fetchData(); // Refresh kredit & riwayat
        triggerCreditUpdate();
      } else {
        throw new Error(json.message);
      }
    } catch (error: any) {
      toast.error("Scan Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full animate-bounce"></div>
            <p className="text-xs font-black tracking-widest uppercase opacity-20">Loading Workspace</p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 font-sans text-slate-900 dark:text-slate-50 pb-20">
      <Header 
        user={user} 
        onLogout={() => { localStorage.clear(); navigate('/landing'); }} 
        onProfile={() => navigate('/profile')} 
        onSettings={() => navigate('/settings')} 
      />

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        
        {/* STATS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <h2 className="text-2xl font-black italic tracking-tighter mb-1">Halo, {user?.name?.split(" ")[0]}!</h2>
                <p className="text-slate-400 text-xs font-medium">Sistem OCR siap memproses dokumen Anda.</p>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl text-blue-600"><FileText className="w-6 h-6"/></div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Scan</p>
                    <p className="text-2xl font-black">{logs.length}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div className={cn(
                    "p-3 rounded-2xl",
                    user?.resetInfo?.color === 'red' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                )}>
                    <ShieldCheck className="w-6 h-6"/>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Status Reset</p>
                    <p className={cn("text-sm font-black", user?.resetInfo?.color === 'red' ? "text-red-600" : "text-green-600")}>
                        {user?.resetInfo?.nextResetDate || "Active"}
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* LEFT: UPLOAD ZONE */}
            <div className="lg:col-span-4">
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm sticky top-24">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                             <Zap className="w-4 h-4 text-blue-600 fill-blue-600"/> Quick Scan
                        </h3>
                        {loading && <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping"></div>}
                    </div>
                    
                    <FileUploadZone onFileSelect={handleScan} />
                    
                    <div className="mt-8 pt-6 border-t border-slate-50 dark:border-zinc-800 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                            Supported: PNG, JPG (Max 5MB)
                        </p>
                    </div>
                </div>
            </div>

            {/* RIGHT: HISTORY TABLE */}
            <div className="lg:col-span-8">
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm min-h-[600px]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400"/> Riwayat Digital
                        </h3>
                    </div>
                    
                    <div className="w-full">
                         <DataTable 
                            logs={logs} 
                            onDeleteLog={async (id) => {
                                if(!confirm("Hapus log?")) return;
                                await apiFetch(`/logs/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${user.credential}` } });
                                fetchData();
                            }} 
                            onUpdateLog={async (id, summary) => {
                                await apiFetch(`/logs/${id}`, { 
                                    method: "PUT", 
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.credential}` },
                                    body: JSON.stringify({ summary }) 
                                });
                                fetchData();
                            }} 
                        />
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
