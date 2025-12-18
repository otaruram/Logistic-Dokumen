import { LogOut, User as UserIcon, Settings, Trash2, Zap, CalendarClock, AlertTriangle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

export default function Header({ user, onLogout, onProfile, onSettings }: HeaderProps) {
  
  const handleDeleteAccount = async () => {
    const confirmText = prompt("Ketik 'HAPUS' untuk menghapus akun permanen.");
    if (confirmText !== "HAPUS") return;
    try {
      await apiFetch("/delete-account", { method: "DELETE", headers: { Authorization: `Bearer ${user.credential}` } });
      toast.success("Akun dihapus. Data hilang."); 
      onLogout(); // Logout otomatis
    } catch (e) { toast.error("Error server"); }
  };

  // --- LOGIKA NOTIFIKASI RESET DATA (BULANAN) ---
  const daysLeft = user?.resetInfo?.daysLeft ?? 30;
  
  // MERAH jika tinggal 7 hari atau kurang
  const isWarning = daysLeft <= 7;
  // Kritis jika tinggal 1 hari
  const isCritical = daysLeft <= 1;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-4 md:px-6 shadow-sm dark:bg-zinc-950/80 dark:border-zinc-800 font-sans">
      
      {/* 1. KREDIT HARIAN (REALTIME) */}
      <div className="flex items-center gap-3">
         <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 md:px-4 rounded-full border border-blue-100 dark:border-blue-800">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-blue-600 fill-blue-600 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 leading-none">
                    Kredit Hari Ini
                </span>
                <span className="text-base md:text-lg font-extrabold text-blue-700 dark:text-blue-400 leading-none">
                    {user?.creditBalance ?? 0}
                </span>
            </div>
         </div>
      </div>
      
      {/* 2. MENU PROFIL + NOTIFIKASI DATA LOG */}
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
              <Avatar className="h-8 w-8 md:h-9 md:w-9 border-2 border-white shadow-sm">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback className="bg-blue-600 text-white font-bold">U</AvatarFallback>
              </Avatar>
              
              {/* Dot Merah muncul di Ikon Profil kalau H-7 */}
              {isWarning && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
              )}
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-72 p-2 font-sans">
            
            {/* --- BOX NOTIFIKASI RESET DATA --- */}
            {user?.resetInfo && (
                <div className={cn(
                    "p-3 rounded-md mb-2 flex flex-col gap-1 border shadow-sm",
                    isWarning 
                        ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300" // WARNA MERAH (H-7)
                        : "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300" // WARNA BIRU (AMAN)
                )}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase">
                        {isWarning ? <AlertTriangle className="w-3 h-3"/> : <CalendarClock className="w-3 h-3" />}
                        <span>
                            {isCritical ? "⚠️ DATA DIHAPUS BESOK!" : isWarning ? `WARNING: H-${daysLeft} RESET DATA` : "Siklus Data Log"}
                        </span>
                    </div>
                    
                    <div className="text-xs font-medium leading-tight mt-1 opacity-90">
                         {isWarning 
                            ? "Data tabel akan dihapus otomatis. Segera Export data Anda!"
                            : `Reset Data Bulanan: ${user.resetInfo.nextResetDate}`
                         }
                    </div>
                </div>
            )}

            <DropdownMenuLabel className="font-normal p-0">
                <div className="flex flex-col space-y-1 bg-slate-50 dark:bg-zinc-900 p-3 rounded-md mb-2">
                    <p className="text-sm font-bold leading-none truncate">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile} className="cursor-pointer"><UserIcon className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings} className="cursor-pointer"><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDeleteAccount} className="text-red-600 focus:bg-red-50 cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4"/> Hapus Akun
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4"/> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
