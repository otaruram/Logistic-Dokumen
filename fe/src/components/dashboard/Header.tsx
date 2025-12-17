import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, User as UserIcon, ChevronDown, Zap } from "lucide-react";

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
        
        {/* KIRI ATAS: KREDIT REALTIME */}
        <div className="flex items-center gap-2 bg-yellow-400/10 px-3 py-1.5 rounded-full border border-yellow-400/20">
            <div className="p-1 bg-yellow-400 rounded-full">
                <Zap className="w-3 h-3 text-black fill-black" />
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase">Sisa Kredit</span>
                <span className="text-sm font-black text-black dark:text-white">{user?.creditBalance ?? 0}</span>
            </div>
        </div>

        {/* KANAN: PROFILE SAJA (Tanpa Bell) */}
        <div className="flex items-center gap-4">
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
