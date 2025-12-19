import { LogOut, User as UserIcon, Settings, Bell, Zap } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

export default function Header({ user, onLogout, onProfile, onSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 dark:bg-zinc-950/80 dark:border-zinc-800">
      <div className="flex items-center gap-3">
         <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800">
            <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Kredit</span>
                <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400 leading-none">
                    {user?.creditBalance ?? 0}
                </span>
            </div>
         </div>
      </div>
      
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-9 w-9 border shadow-sm">
                <AvatarImage src={user?.picture} />
                <AvatarFallback className="bg-blue-600 text-white uppercase">{user?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 p-1">
                    <p className="text-sm font-bold truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile} className="cursor-pointer"><UserIcon className="mr-2 h-4 w-4"/> Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings} className="cursor-pointer"><Settings className="mr-2 h-4 w-4"/> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600 cursor-pointer"><LogOut className="mr-2 h-4 w-4"/> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
