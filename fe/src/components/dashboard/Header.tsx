import { LogOut, User, Settings, Zap } from "lucide-react";
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
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

const Header = ({ user, onLogout, onProfile, onSettings }: HeaderProps) => {
  const credits = user?.creditBalance ?? 0;

  return (
    <header className="border-b-4 border-black bg-white p-4 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        {/* LOGO */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="w-4 h-8 bg-black"></div>
          <h1 className="text-xl font-black tracking-tighter">OCR.WTF</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* CREDIT COUNTER (Hanya Tampil di Atas, Tidak di Dropdown lagi) */}
          <div className="flex items-center gap-2 brutal-border px-3 py-1 bg-yellow-400">
            <Zap className="w-4 h-4 text-black fill-black" />
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-bold uppercase">Credits</span>
              <span className="text-lg font-black">{credits}</span>
            </div>
          </div>

          {/* USER MENU */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-black p-0 hover:bg-gray-200">
                {user?.picture ? (
                  <img src={user.picture} alt="User" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black text-white font-bold">
                    {user?.name?.[0] || "U"}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 brutal-border border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none mt-2 bg-white" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-black" />
              <DropdownMenuItem onClick={onProfile} className="cursor-pointer hover:bg-yellow-200 font-bold">
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSettings} className="cursor-pointer hover:bg-yellow-200 font-bold">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-black" />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 hover:bg-red-100 font-bold">
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
