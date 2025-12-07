import { Circle, LogOut, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    picture: string;
  };
  onLogout?: () => void;
  onGaskeun?: () => void;
  onProfile?: () => void;
}

const Header = ({ user, onLogout, onGaskeun, onProfile }: HeaderProps) => {
  return (
    <header className="brutal-border-thin border-t-0 border-l-0 border-r-0 bg-background">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <h1 className="text-lg md:text-2xl font-bold tracking-tighter">
          <span className="terminal-text inline-block">OCR.WTF</span>
          <span className="terminal-cursor"></span>
        </h1>
        
        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="relative">
                <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full animate-ping"></div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="brutal-border-thin px-3 py-1.5 bg-background flex items-center gap-2 max-w-[200px] h-auto"
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
              
              <DropdownMenuContent align="end" className="brutal-border bg-background min-w-[200px]">
                <DropdownMenuLabel className="font-bold uppercase text-xs">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-foreground/20" />
                
                {onProfile && (
                  <DropdownMenuItem 
                    onClick={onProfile}
                    className="cursor-pointer font-bold uppercase text-xs hover:bg-primary hover:text-primary-foreground"
                  >
                    <User className="w-4 h-4 mr-2" />
                    PROFIL
                  </DropdownMenuItem>
                )}
                
                {onGaskeun && (
                  <DropdownMenuItem 
                    onClick={onGaskeun}
                    className="cursor-pointer font-bold uppercase text-xs hover:bg-primary hover:text-primary-foreground"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    GASKEUN - OKi AI
                  </DropdownMenuItem>
                )}
                
                {onLogout && (
                  <DropdownMenuItem 
                    onClick={onLogout}
                    className="cursor-pointer font-bold uppercase text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
