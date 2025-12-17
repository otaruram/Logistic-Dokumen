import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import NotificationBell from "./NotificationBell"; // Pastikan path ini benar

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

const Header = ({ user, onLogout, onProfile, onSettings }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Kiri: Logo Brand Simple */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
             <span className="text-white dark:text-black font-bold text-sm">SD</span>
          </div>
          <span className="font-bold text-lg tracking-tight text-[#1A1A1A] dark:text-white hidden md:block">
            SmartDoc Pipeline
          </span>
        </div>

        {/* Kanan: Actions */}
        <div className="flex items-center gap-4">
          
          {/* Notification Bell (Pastikan komponen ini stylingnya juga dibersihkan nanti) */}
          <div className="relative">
             <NotificationBell user={user} />
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-zinc-700 mx-1"></div>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 focus:outline-none group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white leading-none">{user?.name || "User"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.tier || "Free Plan"}</p>
              </div>
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-zinc-700 transition-all group-hover:ring-2 group-hover:ring-gray-100">
                <AvatarImage src={user?.picture} />
                <AvatarFallback className="bg-gray-100 dark:bg-zinc-800 text-xs">{user?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-gray-100 dark:border-zinc-800 p-2">
              <DropdownMenuLabel className="text-gray-500 font-normal text-xs uppercase tracking-wider">Akun Saya</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-100" />
              <DropdownMenuItem onClick={onProfile} className="cursor-pointer rounded-lg focus:bg-gray-50 dark:focus:bg-zinc-800">
                <UserIcon className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSettings} className="cursor-pointer rounded-lg focus:bg-gray-50 dark:focus:bg-zinc-800">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-100" />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg">
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
