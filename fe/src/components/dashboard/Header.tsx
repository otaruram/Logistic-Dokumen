import { LogOut, User as UserIcon, Settings, Trash2, Zap, CalendarClock } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

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
      const res = await apiFetch("/delete-account", { method: "DELETE", headers: { Authorization: `Bearer ${user.credential}` } });
      const json = await res.json();
      if (json.status === "success") { toast.success("Akun dihapus."); onLogout(); }
      else { toast.error(json.message); }
    } catch (e) { toast.error("Error server"); }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-4 md:px-6 shadow-sm dark:bg-zinc-950/80 dark:border-zinc-800 font-sans">
      
      {/* KIRI: BADGE KREDIT REALTIME */}
      <div className="flex items-center gap-3">
         <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 md:px-4 rounded-full border border-blue-100 dark:border-blue-800 transition-all hover:shadow-md cursor-default">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-blue-600 fill-blue-600 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 leading-none">Sisa Kredit</span>
                <span className="text-base md:text-lg font-extrabold text-blue-700 dark:text-blue-400 leading-none">
                    {user?.creditBalance ?? 0}
                </span>
            </div>
         </div>
      </div>
      
      {/* KANAN: PROFIL DROPDOWN */}
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <Avatar className="h-8 w-8 md:h-9 md:w-9 border-2 border-white shadow-sm transition-transform active:scale-95">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback className="bg-blue-600 text-white font-bold font-sans">U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 md:w-64 p-2 font-sans">
            
            {/* INFO RESET KREDIT SIMPEL (MUNBUL SAAT DISENTUH) */}
            {user?.resetInfo && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md mb-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                    <CalendarClock className="w-3 h-3" />
                    <span className="font-medium">Reset Kredit: {user.resetInfo.nextResetDate}</span>
                </div>
            )}

            <DropdownMenuLabel className="font-normal p-0">
                <div className="flex flex-col space-y-1 bg-slate-50 dark:bg-zinc-900 p-3 rounded-md mb-2">
                    <p className="text-sm font-bold leading-none truncate">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
            </DropdownMenuLabel>
            
            {/* NOTIFIKASI DIHILANGKAN */}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile} className="cursor-pointer"><UserIcon className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings} className="cursor-pointer"><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDeleteAccount} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4"/> Hapus Akun
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4"/> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
