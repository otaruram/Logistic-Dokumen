import { Circle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    picture: string;
  };
  onLogout?: () => void;
}

const Header = ({ user, onLogout }: HeaderProps) => {
  return (
    <header className="brutal-border-thin border-t-0 border-l-0 border-r-0 bg-background">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <h1 className="text-lg md:text-2xl font-bold tracking-tighter">
          <span className="terminal-text inline-block">LOGISTIC.AI OCR</span>
          <span className="terminal-cursor"></span>
        </h1>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 brutal-border-thin px-3 py-1.5 md:px-4 md:py-2 bg-background">
            <Circle className="w-2.5 h-2.5 md:w-3 md:h-3 fill-success text-success led-blink" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">
              SYSTEM ONLINE
            </span>
          </div>
          
          {user && (
            <div className="flex items-center gap-2">
              <div className="brutal-border-thin px-3 py-1.5 bg-background flex items-center gap-2 max-w-[200px]">
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
              </div>
              
              {onLogout && (
                <Button
                  onClick={onLogout}
                  variant="outline"
                  size="sm"
                  className="brutal-border-thin px-3 py-1.5 h-auto"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
