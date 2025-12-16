import { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, CheckCircle, Zap, TrendingDown, TrendingUp, History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface NotificationBellProps {
  user: any;
}

type CreditLog = {
  id: number;
  type: 'decrease' | 'increase' | 'reset';
  amount: number;
  message: string;
  time: string;
};

const NotificationBell = ({ user }: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [nextDeleteDate, setNextDeleteDate] = useState<string>("Menghitung..."); // Default Text
  const [creditLogs, setCreditLogs] = useState<CreditLog[]>([]);
  
  const prevCreditRef = useRef<number>(user?.creditBalance ?? 0);
  const isFirstRender = useRef(true);

  // 1. DETEKSI PERUBAHAN KREDIT (LOGIKA LOG)
  useEffect(() => {
    const currentCredit = user?.creditBalance ?? 0;
    
    // Saat load pertama kali, jika user baru login dan kreditnya 3 (default), 
    // kita anggap itu "Reset Harian" agar log tidak kosong.
    if (isFirstRender.current) {
      prevCreditRef.current = currentCredit;
      isFirstRender.current = false;
      if (currentCredit > 0) {
         setCreditLogs([{ 
             id: Date.now(), 
             type: 'increase', 
             amount: currentCredit, 
             message: "Status Awal/Reset", 
             time: new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) 
         }]);
      }
      return;
    }

    if (currentCredit !== prevCreditRef.current) {
      const diff = currentCredit - prevCreditRef.current;
      const now = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
      let newLog: CreditLog | null = null;

      if (diff < 0) {
        newLog = { id: Date.now(), type: 'decrease', amount: Math.abs(diff), message: "Scan Dokumen", time: now };
      } else if (diff > 0) {
        newLog = { id: Date.now(), type: 'increase', amount: diff, message: "Topup/Reset", time: now };
      }

      if (newLog) setCreditLogs(prev => [newLog!, ...prev].slice(0, 5));
      prevCreditRef.current = currentCredit;
    }
  }, [user?.creditBalance]);

  // 2. LOGIKA TANGGAL DATA CLEANUP (PERBAIKAN FITUR ANEH)
  useEffect(() => {
    // Fallback: Jika user.createdAt tidak ada, pakai tanggal hari ini
    const joinDateStr = user?.createdAt || new Date().toISOString();
    calculateDeletionDate(joinDateStr);
  }, [user]);

  const calculateDeletionDate = (joinDateStr: string) => {
    try {
      const joinDate = new Date(joinDateStr);
      const today = new Date();
      
      // Target: Tanggal yang sama di bulan depan
      let targetDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate());
      
      // Jika target sudah lewat, geser ke bulan depannya lagi
      if (targetDate < today) {
          targetDate = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate());
      }
      
      const diffTime = Math.abs(targetDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      setDaysLeft(diffDays);
      setNextDeleteDate(targetDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }));
    } catch (e) { 
        console.error(e); 
        setNextDeleteDate("Error Tanggal");
    }
  };

  const isWarning = daysLeft !== null && daysLeft <= 7;
  const hasUnread = creditLogs.some(l => l.type === 'decrease' || l.type === 'increase') || isWarning;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative h-12 w-12 border-4 border-black dark:border-white p-0 hover:bg-yellow-400 dark:hover:bg-yellow-400 rounded-none group transition-all overflow-hidden">
          <Bell className={`h-6 w-6 transition-all duration-300 group-hover:rotate-[20deg] group-hover:scale-110 ${hasUnread ? "text-black animate-pulse" : "text-black dark:text-white"}`} />
          {hasUnread && <span className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-red-600 border-2 border-white animate-bounce"></span>}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 brutal-border border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_black] dark:shadow-[6px_6px_0px_0px_white] p-0 bg-white dark:bg-zinc-900" align="start">
        
        <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-black dark:border-white">
          <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Bell className="w-3 h-3" /> PEMBERITAHUAN</span>
          <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 font-bold border border-white">REALTIME</span>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {/* SECTION 1: KREDIT */}
          <div className="p-4 bg-yellow-50 dark:bg-zinc-800 border-b-2 border-black dark:border-white">
            <div className="flex justify-between items-end mb-1">
              <h4 className="font-bold text-xs uppercase text-gray-500 dark:text-gray-300">SISA KREDIT</h4>
              <Zap className="w-4 h-4 text-black dark:text-yellow-400 fill-yellow-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter dark:text-white">{user?.creditBalance ?? 0}</span>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">/ HARI</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 border-t border-yellow-200 dark:border-gray-600 pt-2">*Reset otomatis jam 00:00 WIB.</p>
          </div>

          {/* SECTION 2: LOG AKTIVITAS */}
          <div className="p-4 border-b-2 border-gray-100 dark:border-gray-700">
              <h4 className="font-bold text-xs uppercase text-gray-400 mb-3 flex items-center gap-2"><History className="w-3 h-3" /> AKTIVITAS HARI INI</h4>
              {creditLogs.length > 0 ? (
                  <div className="space-y-2">
                    {creditLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-xs animate-in slide-in-from-right-2">
                        <div className="flex items-center gap-2">
                          {log.type === 'decrease' ? <TrendingDown className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-green-500" />}
                          <div><p className="font-bold dark:text-white">{log.message}</p><p className="text-[10px] text-gray-400">{log.time}</p></div>
                        </div>
                        <span className={`font-black ${log.type === 'decrease' ? 'text-red-600' : 'text-green-600'}`}>
                          {log.type === 'decrease' ? '-' : '+'}{log.amount}
                        </span>
                      </div>
                    ))}
                  </div>
              ) : (
                  <p className="text-[10px] text-gray-400 italic">Belum ada aktivitas.</p>
              )}
          </div>

          {/* SECTION 3: JADWAL HAPUS (Fix Tanggal Kosong) */}
          <div className="p-4">
             <h4 className="font-bold text-xs uppercase text-gray-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> DATA CLEANUP</h4>
            <div className={`flex items-start gap-3 p-3 border-2 ${isWarning ? "bg-red-50 border-red-500" : "bg-white dark:bg-zinc-800 border-black dark:border-white"}`}>
              {isWarning ? <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
              <div>
                <h4 className={`font-bold text-sm uppercase ${isWarning ? "text-red-700" : "text-black dark:text-white"}`}>
                  {isWarning ? "⚠️ HAPUS SEGERA!" : "Data Aman"}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  Reset berikutnya:<br/>
                  <strong className="text-black dark:text-white bg-yellow-200 dark:bg-yellow-600 px-1">{nextDeleteDate}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
