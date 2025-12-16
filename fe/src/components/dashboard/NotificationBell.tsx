import { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, CheckCircle, Zap, TrendingDown, TrendingUp, History } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [nextDeleteDate, setNextDeleteDate] = useState<string>("");
  const [creditLogs, setCreditLogs] = useState<CreditLog[]>([]);
  
  const prevCreditRef = useRef<number>(user?.creditBalance ?? 0);
  const isFirstRender = useRef(true);

  // LOGIC DETEKSI KREDIT (Sama seperti sebelumnya)
  useEffect(() => {
    const currentCredit = user?.creditBalance ?? 0;
    if (isFirstRender.current) {
      prevCreditRef.current = currentCredit;
      isFirstRender.current = false;
      return;
    }
    const prevCredit = prevCreditRef.current;
    if (currentCredit !== prevCredit) {
      const diff = currentCredit - prevCredit;
      const now = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
      let newLog: CreditLog | null = null;
      if (diff < 0) {
        newLog = { id: Date.now(), type: 'decrease', amount: Math.abs(diff), message: "Scan Dokumen", time: now };
      } else if (diff > 0) {
        newLog = { id: Date.now(), type: 'increase', amount: diff, message: "Reset/Topup", time: now };
      }
      if (newLog) setCreditLogs(prev => [newLog!, ...prev].slice(0, 5));
      prevCreditRef.current = currentCredit;
    }
  }, [user?.creditBalance]);

  // LOGIC TANGGAL HAPUS (Sama seperti sebelumnya)
  useEffect(() => {
    if (user?.createdAt) calculateDeletionDate(user.createdAt);
  }, [user]);

  const calculateDeletionDate = (joinDateStr: string) => {
    try {
      const joinDate = new Date(joinDateStr);
      const today = new Date();
      let targetDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate());
      if (targetDate < today) targetDate = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate());
      
      const diffTime = Math.abs(targetDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      setDaysLeft(diffDays);
      setNextDeleteDate(targetDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'long' }));
    } catch (e) { console.error(e); }
  };

  const isWarning = daysLeft !== null && daysLeft <= 7;
  const hasUnread = creditLogs.length > 0 || isWarning;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {/* 🔥 UPDATE ANIMASI & STYLE TOMBOL DI SINI 🔥 */}
        <Button variant="ghost" className="relative h-12 w-12 border-4 border-black p-0 hover:bg-yellow-400 rounded-none group transition-all overflow-hidden">
          <Bell className={`h-6 w-6 transition-all duration-300 group-hover:rotate-[20deg] group-hover:scale-110 ${hasUnread ? "text-black animate-pulse" : "text-black"}`} />
          
          {/* Dot Merah Notifikasi */}
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-red-600 border-2 border-white animate-bounce"></span>
          )}
        </Button>
      </PopoverTrigger>
      
      {/* align="start" AGAR POPUP MUNCUL DI KIRI (Sesuai posisi baru) */}
      <PopoverContent className="w-80 brutal-border border-4 border-black shadow-[6px_6px_0px_0px_black] p-0 bg-white ml-2" align="start">
        
        <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-black">
          <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            <Bell className="w-3 h-3" /> PEMBERITAHUAN
          </span>
          <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 font-bold border border-white">
            REALTIME
          </span>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {/* SECTION 1: KREDIT */}
          <div className="p-4 bg-yellow-50 border-b-2 border-black">
            <div className="flex justify-between items-end mb-1">
              <h4 className="font-bold text-xs uppercase text-gray-500">SISA KREDIT</h4>
              <Zap className="w-4 h-4 text-black fill-yellow-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter">{user?.creditBalance ?? 0}</span>
              <span className="text-xs font-bold text-gray-500">/ HARI</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 border-t border-yellow-200 pt-2">
              *Reset otomatis jam 00:00 WIB.
            </p>
          </div>

          {/* SECTION 2: LOG */}
          {creditLogs.length > 0 && (
            <div className="p-4 border-b-2 border-gray-100">
              <h4 className="font-bold text-xs uppercase text-gray-400 mb-3 flex items-center gap-2">
                <History className="w-3 h-3" /> AKTIVITAS
              </h4>
              <div className="space-y-2">
                {creditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs animate-in slide-in-from-right-2">
                    <div className="flex items-center gap-2">
                      {log.type === 'decrease' ? <TrendingDown className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-green-500" />}
                      <div><p className="font-bold">{log.message}</p><p className="text-[10px] text-gray-400">{log.time}</p></div>
                    </div>
                    <span className={`font-black ${log.type === 'decrease' ? 'text-red-600' : 'text-green-600'}`}>
                      {log.type === 'decrease' ? '-' : '+'}{log.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: JADWAL HAPUS */}
          <div className="p-4">
             <h4 className="font-bold text-xs uppercase text-gray-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" /> DATA CLEANUP
              </h4>
            <div className={`flex items-start gap-3 p-3 border-2 ${isWarning ? "bg-red-50 border-red-500" : "bg-white border-black"}`}>
              {isWarning ? <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
              <div>
                <h4 className={`font-bold text-sm uppercase ${isWarning ? "text-red-700" : "text-black"}`}>
                  {isWarning ? "⚠️ HAPUS SEGERA!" : "Data Aman"}
                </h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Reset: <strong>{nextDeleteDate}</strong>
                </p>
                {isWarning && <div className="mt-2"><span className="text-[10px] font-bold bg-red-600 text-white px-2 py-1">SISA: {daysLeft} HARI</span></div>}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
