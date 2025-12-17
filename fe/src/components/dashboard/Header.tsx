import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, User as UserIcon, ChevronDown, Zap, AlertTriangle, CalendarClock } from "lucide-react";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

const Header = ({ user, onLogout, onProfile, onSettings }: HeaderProps) => {
  const resetInfo = user?.resetInfo;
  const showWarning = resetInfo?.showWarning;
  const daysLeft = resetInfo?.daysLeft;
  const resetDate = resetInfo?.nextResetDate;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* KIRI ATAS: KREDIT */}
        <div className="flex items-center gap-3">
            <div className="bg-yellow-400 text-black px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-sm">
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span className="uppercase tracking-wider">KREDIT: {user?.creditBalance ?? 0}</span>
            </div>
        </div>

        {/* KANAN: PROFILE DROPDOWN + NOTIFIKASI */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 focus:outline-none group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white leading-none">{user?.name || "User"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.tier || "Free Plan"}</p>
              </div>
              <div className="relative">
                <Avatar className="h-9 w-9 border border-gray-200 dark:border-zinc-700 transition-all group-hover:ring-2 group-hover:ring-gray-100">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback className="bg-gray-100 dark:bg-zinc-800 text-xs">{user?.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                {showWarning && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                    </span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-xl border-gray-100 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-900">
              {/* NOTIFIKASI RESET */}
              {showWarning ? (
                  <div className="mb-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                      <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                          <div>
                              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Warning Data Reset</p>
                              <p className="text-[10px] text-red-600 dark:text-red-300 mt-1 leading-tight">
                                  Reset otomatis dalam <b>{daysLeft} hari</b> ({resetDate}).<br/>Silakan export data Anda.
                              </p>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="mb-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-green-600" />
                      <div>
                          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Data Aman</p>
                          <p className="text-[10px] text-green-600 dark:text-green-300">Reset: {resetDate || "-"}</p>
                      </div>
                  </div>
              )}
              <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800" />
              <DropdownMenuItem onClick={onProfile} className="cursor-pointer rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"><UserIcon className="mr-2 h-4 w-4" /> Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={onSettings} className="cursor-pointer rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800" />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg"><LogOut className="mr-2 h-4 w-4" /> Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
export default Header;
