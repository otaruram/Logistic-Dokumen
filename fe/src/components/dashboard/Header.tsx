import { Zap, CalendarClock, User, Settings, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function Header({ user, onLogout, onProfile, onSettings }: any) {
  const daysLeft = user?.resetInfo?.daysLeft ?? 30;
  const isWarning = daysLeft <= 7;

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-2 border border-blue-100">
          <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
          <span className="text-sm font-bold text-blue-700">{user?.creditBalance ?? 0}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user?.resetInfo && (
          <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold border ${isWarning ? "bg-red-50 text-red-600 border-red-100" : "bg-zinc-50 text-zinc-400"}`}>
            <CalendarClock className="w-3 h-3" />
            <span>RESET DATA: {user.resetInfo.nextResetDate}</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 w-10 rounded-full"><Avatar><AvatarImage src={user?.picture} /></Avatar></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onProfile}><User className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings}><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="text-red-600"><LogOut className="mr-2 h-4 w-4"/> Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
