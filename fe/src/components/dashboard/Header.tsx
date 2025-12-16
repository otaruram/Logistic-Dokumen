import { Circle, LogOut, User, Settings, Zap, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    picture: string;
    creditBalance?: number; // Field saldo utama
    credits?: number;       // Field saldo fallback
  };
  onLogout?: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
  onViewCreditHistory?: () => void; // Opsional: Untuk modal history
}

const Header = ({ user, onLogout, onProfile, onSettings, onViewCreditHistory }: HeaderProps) => {
  const [animateCredit, setAnimateCredit] = useState(false);
  
  // 1. Ambil saldo kredit aman (fallback ke 0)
  const creditBalance = user?.creditBalance ?? user?.credits ?? 0;

  // 2. Efek animasi 'Pop' saat kredit berubah
  useEffect(() => {
    setAnimateCredit(true);
    const timer = setTimeout(() => setAnimateCredit(false), 300);
    return () => clearTimeout(timer);
  }, [creditBalance]);

  return (
    <header className="brutal-border-thin border-t-0 border-l-0 border-r-0 bg-background sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        
        {/* LOGO AREA */}
        <h1 className="text-lg md:text-2xl font-bold tracking-tighter">
          <span className="terminal-text inline-block">OCR.WTF</span>
          <span className="terminal-cursor">_</span>
        </h1>

        <div className="flex items-center gap-3">
          {user && (
            <>
              {/* 🔥 CREDIT BADGE (BRUTALIST STYLE) 🔥 */}
              <div 
                onClick={onViewCreditHistory}
                className={`
                  cursor-pointer flex items-center gap-2 px-3 py-1.5 
                  brutal-border-thin bg-background
                  transition-all duration-200 select-none
                  ${animateCredit ? 'scale-110 bg-yellow-100' : ''}
                  hover:bg-accent
                `}
                title="Sisa Kredit Anda"
              >
                <Zap className={`w-3.5 h-3.5 md:w-4 md:h-4 ${creditBalance > 0 ? 'fill-yellow-400 text-black' : 'text-red-500'}`} />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[8px] md:text-[10px] font-bold uppercase text-muted-foreground">CREDITS</span>
                  <span className={`text-xs md:text-sm font-bold font-mono ${creditBalance === 0 ? 'text-destructive' : ''}`}>
                    {creditBalance}
                  </span>
                </div>
              </div>

              {/* USER DROPDOWN */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="brutal-border-thin px-3 py-1.5 bg-background flex items-center gap-2 max-w-[200px] h-auto rounded-none focus:ring-0"
                  >
                    {user.picture ? (
                      <img 
                        src={user.picture} 
                        alt={user.name}
                        className="w-6 h-6 rounded-full brutal-border-thin flex-shrink-0"
                      />
                    ) : (
                      <User className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-[10px] md:text-xs font-bold uppercase hidden md:inline truncate">
                      {user.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="brutal-border bg-background min-w-[200px] rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <DropdownMenuLabel className="font-bold uppercase text-xs bg-muted/50">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-foreground/20" />

                  {onProfile && (
                    <DropdownMenuItem 
                      onClick={onProfile}
                      className="cursor-pointer font-bold uppercase text-xs hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                    >
                      <User className="w-4 h-4 mr-2" />
                      PROFIL
                    </DropdownMenuItem>
                  )}
                  
                  {/* Menu Riwayat Kredit */}
                  {onViewCreditHistory && (
                    <DropdownMenuItem 
                      onClick={onViewCreditHistory}
                      className="cursor-pointer font-bold uppercase text-xs hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                    >
                      <History className="w-4 h-4 mr-2" />
                      RIWAYAT KREDIT
                    </DropdownMenuItem>
                  )}

                  {onSettings && (
                    <DropdownMenuItem 
                      onClick={onSettings}
                      className="cursor-pointer font-bold uppercase text-xs hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      SETTINGS
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="bg-foreground/20" />

                  {onLogout && (
                    <DropdownMenuItem 
                      onClick={onLogout}
                      className="cursor-pointer font-bold uppercase text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      KELUAR
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
