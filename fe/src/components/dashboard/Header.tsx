import { LogOut, User as UserIcon, Settings, Trash2, Zap, AlertTriangle, CalendarClock } from "lucide-react";
// ... imports lain (Dropdown, Avatar, dll) ...

export default function Header({ user, onLogout, onProfile, onSettings }: HeaderProps) {
  
  // ... fungsi delete account ...

  // LOGIKA WARNA NOTIFIKASI
  const daysLeft = user?.resetInfo?.daysLeft ?? 30;
  
  // H-7 sampai H-1 = MERAH (Warning)
  // Sisanya = HIJAU/BIRU (Aman)
  const isWarning = daysLeft <= 7; 

  return (
    <header className="...">
      {/* KREDIT HARIAN */}
      <div className="flex items-center gap-3">
         <div className="bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400">Kredit Hari Ini</span>
                <span className="text-lg font-extrabold text-blue-700">{user?.creditBalance ?? 0}</span>
            </div>
         </div>
      </div>
      
      {/* NOTIFIKASI RESET DATA (DROPDOWN) */}
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative rounded-full">
              <Avatar><AvatarImage src={user?.picture} /></Avatar>
              
              {/* DOT MERAH (Muncul Hanya Saat H-7) */}
              {isWarning && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
              )}
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-72">
            {/* BOX INFO STATUS */}
            {user?.resetInfo && (
                <div className={`p-3 rounded-md mb-2 border ${
                    isWarning 
                    ? "bg-red-50 border-red-200 text-red-700" // WARNA MERAH
                    : "bg-emerald-50 border-emerald-200 text-emerald-700" // WARNA HIJAU (AMAN)
                }`}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase">
                        {isWarning ? <AlertTriangle className="w-3 h-3"/> : <CalendarClock className="w-3 h-3" />}
                        <span>
                            {isWarning ? `WARNING: RESET H-${daysLeft}` : "STATUS DATA: AMAN"}
                        </span>
                    </div>
                    <div className="text-xs font-medium mt-1">
                        {isWarning 
                            ? "Data akan dihapus sebentar lagi. Segera Export!" 
                            : `Reset berikutnya: ${user.resetInfo.nextResetDate}`
                        }
                    </div>
                </div>
            )}
            
            {/* ... Menu User Lainnya ... */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
