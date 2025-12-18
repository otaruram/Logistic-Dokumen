import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Settings, 
  LogOut, 
  User as UserIcon, 
  ChevronDown, 
  Zap, 
  AlertTriangle, 
  CalendarClock,
  Bell
} from "lucide-react";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

const Header = ({ user, onLogout, onProfile, onSettings }: HeaderProps) => {
  // Ambil data notifikasi dari user (dikirim dari backend /me)
  const resetInfo = user?.resetInfo;
  const showWarning = resetInfo?.showWarning ?? false;
  const daysLeft = resetInfo?.daysLeft ?? 30;
  const resetDate = resetInfo?.nextResetDate ?? "-";

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 transition-all">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* KIRI: LOGO & KREDIT */}
        <div className="flex items-center gap-4">
            {/* Logo Text Mobile/Desktop */}
            <span className="font-black text-lg tracking-tight hidden sm:block">SMARTDOC</span>
            
            {/* Badge Kredit */}
            <div className="bg-yellow-400 text-black px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-sm transform active:scale-95 transition-transform">
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span className="uppercase tracking-wider">KREDIT: {user?.creditBalance ?? 0}</span>
            </div>
        </div>

        {/* KANAN: MENU & NOTIFIKASI */}
        <div className="flex items-center gap-3">
          
          {/* ICON LONCENG (Hanya muncul titik merah jika warning) */}
          <div className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            {showWarning && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 focus:outline-none group p-1 pr-3 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 transition-all">
              <Avatar className="h-8 w-8 border border-gray-200 dark:border-zinc-700">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="bg-gray-100 dark:bg-zinc-800 text-xs font-bold">
                    {user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
              </Avatar>
              
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-[#1A1A1A] dark:text-white leading-none max-w-[100px] truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                  {user?.tier || "Free Plan"}
                </p>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-72 rounded-2xl shadow-xl border-gray-100 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-900 mt-2">
              
              {/* HEADER DROPDOWN */}
              <div className="px-2 py-2 mb-1">
                <p className="font-bold text-sm">Status Akun</p>
              </div>

              {/* KARTU NOTIFIKASI RESET (DINAMIS) */}
              {showWarning ? (
                  <div className="mb-2 mx-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                      <div className="flex items-start gap-3">
                          <div className="p-2 bg-red-100 dark:bg-red-800/30 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">Warning Reset</p>
                              <p className="text-[10px] text-red-600 dark:text-red-300 mt-1 leading-relaxed">
                                  Data akan di-reset dalam <b>{daysLeft} hari</b> ({resetDate}).<br/>
                                  Segera export data Anda ke Excel/Drive.
                              </p>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="mb-2 mx-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                            <CalendarClock className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                              <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Data Aman</p>
                              <p className="text-[10px] text-green-600 dark:text-green-300 mt-0.5">
                                Reset berikutnya: <br/><b>{resetDate}</b>
                              </p>
                          </div>
                      </div>
                  </div>
              )}

              <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800 my-2" />
              
              <DropdownMenuItem onClick={onProfile} className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-gray-50 dark:focus:bg-zinc-800 font-medium text-sm">
                <UserIcon className="mr-3 h-4 w-4 text-gray-500" /> Profile Saya
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={onSettings} className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-gray-50 dark:focus:bg-zinc-800 font-medium text-sm">
                <Settings className="mr-3 h-4 w-4 text-gray-500" /> Pengaturan
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-gray-100 dark:bg-zinc-800 my-2" />
              
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-900/20 rounded-lg px-3 py-2.5 font-bold text-sm">
                <LogOut className="mr-3 h-4 w-4" /> Keluar Aplikasi
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
