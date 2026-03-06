import { motion } from "framer-motion";
import { LayoutDashboard, Scan, Menu, User, Sparkles, Shield } from "lucide-react";
import { NAVIGATION_TABS } from "@/constants";
import { TabType } from "@/types";

interface BottomNavigationProps {
  activeTab: TabType;
  onTabClick: (tabId: string) => void;
  getActiveTabId: () => string;
  isAdmin?: boolean;
}

const TAB_ICONS = {
  dashboard: LayoutDashboard,
  dgtnz: Scan,
  otaru: Sparkles,
  options: Menu,
  profile: User,
  admin: Shield,
} as const;

const BottomNavigation = ({ activeTab, onTabClick, getActiveTabId, isAdmin }: BottomNavigationProps) => {
  // Build tab list: insert admin tab after dashboard if admin
  const tabs = isAdmin
    ? [
      NAVIGATION_TABS[0], // Dashboard
      { id: "admin" as const, label: "Admin" },
      ...NAVIGATION_TABS.slice(1),
    ]
    : [...NAVIGATION_TABS];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-around items-center py-2">
          {tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id as keyof typeof TAB_ICONS];
            const isActive = getActiveTabId() === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabClick(tab.id)}
                className="nav-item relative flex-1"
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                <span className={`text-[10px] mt-0.5 ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-foreground rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;
