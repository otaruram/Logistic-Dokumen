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
    <header className="border-b-4 border-black bg-white p-4 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        
        {/* KIRI: NOTIFIKASI BELL (Pengganti Logo) */}
        <div className="flex items-center">
           <NotificationBell user={user} />
        </div>

        {/* KANAN: PROFIL USER */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-12 w-12 rounded-full border-4 border-black p-0 hover:bg-yellow-400 transition-colors focus:ring-0">
                {user?.picture ? (
                  <img src={user.picture} alt="User" className="h-full w-full rounded-full object-cover border-2 border-white" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black text-white font-bold text-xl">
                    {user?.name?.[0] || "U"}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 brutal-border border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none mt-2 bg-white" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none truncate">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
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
