import { LogOut, User as UserIcon, Settings, Trash2, Bell, Zap } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 shadow-sm dark:bg-zinc-950/80 dark:border-zinc-800">
      
      {/* BAGIAN KIRI: FOKUS KE KREDIT (PENGGANTI BRAND) */}
      <div className="flex items-center gap-3">
         <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 transition-all hover:shadow-md">
            <Zap className="w-5 h-5 text-blue-600 fill-blue-600 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Sisa Kredit</span>
                <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400 leading-none">
                    {user?.creditBalance ?? 0}
                </span>
            </div>
         </div>
         {/* Info Reset Kecil di sebelahnya */}
         {user?.resetInfo && (
            <span className="hidden md:inline-block text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
               Reset: {user.resetInfo.nextResetDate}
            </span>
         )}
      </div>
      
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
              <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback className="bg-blue-600 text-white font-bold">U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 bg-slate-50 dark:bg-zinc-900 p-3 rounded-md mb-2">
                    <p className="text-sm font-bold leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
            </DropdownMenuLabel>
            
            {/* FITUR NOTIFIKASI DISINI */}
            <DropdownMenuItem className="cursor-pointer">
                <Bell className="mr-2 h-4 w-4 text-slate-500"/> 
                <span>Notifikasi</span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">Baru</Badge>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile}><UserIcon className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings}><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDeleteAccount} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">
                <Trash2 className="mr-2 h-4 w-4"/> Hapus Akun
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout}><LogOut className="mr-2 h-4 w-4"/> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
