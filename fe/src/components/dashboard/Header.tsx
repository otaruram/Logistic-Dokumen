import { LogOut, User as UserIcon, Settings, Trash2 } from "lucide-react";
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
  
  // FIX ISSUE NO 1: Logic Hapus Akun yang Benar
  const handleDeleteAccount = async () => {
    const confirmText = prompt("Ketik 'HAPUS' (huruf besar) untuk menghapus akun permanen. Data hilang selamanya.");
    if (confirmText !== "HAPUS") return;

    try {
      toast.info("Sedang menghapus data...");
      const res = await apiFetch("/delete-account", { 
          method: "DELETE", 
          headers: { Authorization: `Bearer ${user.credential}` } 
      });
      const json = await res.json();

      if (json.status === "success") {
        toast.success("Akun berhasil dihapus.");
        onLogout(); // Logout paksa
      } else {
        toast.error(json.message || "Gagal menghapus akun");
      }
    } catch (e) {
      toast.error("Kesalahan koneksi ke server");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
      <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
        <span className="text-blue-600">OCR</span>.wtf
      </div>
      
      <div className="ml-auto flex items-center gap-4">
        {/* FIX ISSUE NO 3: Info Reset Waktu */}
        {user && (
           <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">
                Kredit: <span className="text-blue-600 font-bold">{user.creditBalance ?? 0}</span>
              </div>
              {user.resetInfo && (
                <div className="text-[10px] text-gray-400">
                  Reset: {user.resetInfo.nextResetDate}
                </div>
              )}
           </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8 border">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile}><UserIcon className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings}><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            
            {/* Menu Hapus Akun */}
            <DropdownMenuItem onClick={handleDeleteAccount} className="text-red-600 focus:text-red-600 cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4"/> Hapus Akun
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={onLogout}><LogOut className="mr-2 h-4 w-4"/> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
