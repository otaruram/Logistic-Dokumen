import { LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "./NotificationBell";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

const Header = ({ user, onLogout, onProfile, onSettings }: HeaderProps) => {
  return (
    <header className="border-b-4 border-black dark:border-white bg-white dark:bg-black p-4 sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto flex justify-between items-center">
        
        {/* KIRI: NOTIFIKASI BELL */}
        <div className="flex items-center">
           <NotificationBell user={user} />
        </div>

        {/* KANAN: PROFIL USER */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-12 w-12 rounded-full border-4 border-black dark:border-white p-0 hover:bg-yellow-400 dark:hover:bg-yellow-400 transition-all focus:ring-0 active:scale-95 duration-200">
                {user?.picture ? (
                  <img src={user.picture} alt="User" className="h-full w-full rounded-full object-cover border-2 border-white" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black dark:bg-white text-white dark:text-black font-bold text-xl">
                    {user?.name?.[0] || "U"}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            
            {/* 🔥 ANIMASI & DARK MODE FIX 🔥 */}
            <DropdownMenuContent 
              className="w-56 brutal-border border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] rounded-none mt-2 bg-white dark:bg-zinc-900 animate-in zoom-in-95 slide-in-from-top-2 duration-200" 
              align="end"
            >
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none truncate text-black dark:text-white">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-black dark:bg-white" />
              
              <DropdownMenuItem onClick={onProfile} className="cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-600 dark:text-white font-bold transition-colors focus:bg-yellow-200 dark:focus:bg-yellow-600">
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={onSettings} className="cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-600 dark:text-white font-bold transition-colors focus:bg-yellow-200 dark:focus:bg-yellow-600">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-black dark:bg-white" />
              
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 font-bold transition-colors focus:bg-red-100">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
