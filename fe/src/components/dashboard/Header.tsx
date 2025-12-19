import { LogOut, User as UserIcon, Settings, Trash2, Zap, CalendarClock, AlertTriangle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
}

export default function Header({ user, onLogout, onProfile }: HeaderProps) {
  // Logika Notifikasi Reset Data (30 Hari)
  const daysLeft = user?.resetInfo?.daysLeft ?? 30;
  const isWarning = daysLeft <= 7; // Mulai Merah di H-7

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-white/80 backdrop-blur-md px-4 md:px-6 dark:bg-zinc-950/80 dark:border-zinc-800 font-sans">
      
      {/* KIRI: KREDIT HARIAN (ALWAYS 3) */}
      <div className="flex items-center gap-3">
         <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800">
            <Zap className="w-4 h-4 text-blue-600 fill-blue-600 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 leading-none">Kredit Hari Ini</span>
                <span className="text-base font-extrabold text-blue-700 dark:text-blue-400">{user?.creditBalance ?? 0}</span>
            </div>
         </div>
      </div>
      
      {/* KANAN: PROFIL & DROPDOWN NOTIFIKASI */}
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                <AvatarImage src={user?.picture} />
                <AvatarFallback className="bg-blue-600 text-white font-bold">U</AvatarFallback>
              </Avatar>
              {isWarning && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
              )}
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-72 p-2">
            {/* KARTU NOTIFIKASI RESET DATA */}
            {user?.resetInfo && (
                <div className={cn(
                    "p-3 rounded-xl mb-2 flex flex-col gap-1 border shadow-sm",
                    isWarning 
                        ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30" 
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20"
                )}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                        {isWarning ? <AlertTriangle className="w-3 h-3"/> : <CalendarClock className="w-3 h-3" />}
                        <span>{isWarning ? `WARNING: H-${daysLeft} RESET DATA` : "STATUS PENYIMPANAN"}</span>
                    </div>
                    <p className="text-xs opacity-90">
                        {isWarning 
                            ? "Data tabel akan dihapus otomatis. Segera Export!" 
                            : `Data aman. Reset berikutnya: ${user.resetInfo.nextResetDate}`}
                    </p>
                </div>
            )}

            <DropdownMenuLabel className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl mb-2">
                <p className="text-sm font-bold truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </DropdownMenuLabel>
            
            <DropdownMenuItem onClick={onProfile} className="rounded-lg cursor-pointer"><UserIcon className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg cursor-pointer"><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="rounded-lg cursor-pointer text-red-600"><LogOut className="mr-2 h-4 w-4"/> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
