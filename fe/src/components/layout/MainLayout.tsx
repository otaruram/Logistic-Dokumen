import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "./Header";
import DashboardTab from "../tabs/DashboardTab";
import DgtnzTab from "../tabs/DgtnzTab";
import ApiTab from "../tabs/ApiTab";
import ProfileTab from "../tabs/ProfileTab";
import OtaruChatPage from "@/pages/OtaruChatPage";
import AdminTab from "../tabs/AdminTab";
import BottomNavigation from "../ui/bottom-navigation";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

const ADMIN_EMAIL = "okitr52@gmail.com";

const MainLayout = () => {
  const {
    activeTab,
    handleTabClick,
    getActiveTabId,
  } = useTabNavigation();

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedFeatureMode, setSelectedFeatureMode] = useState<"default" | "fraud">("fraud");

  useEffect(() => {
    // Check if current user is admin
    const checkAdmin = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.email === ADMIN_EMAIL) {
          setIsAdmin(true);
        }
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;
      case "admin":
        return isAdmin ? <AdminTab /> : <DashboardTab />;
      case "dgtnz":
        return <DgtnzTab onBack={() => handleTabClick("dashboard")} initialMode={selectedFeatureMode} />;
      case "otaru":
        return <OtaruChatPage />;
      case "api":
        return <ApiTab />;
      case "profile":
        return <ProfileTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col transition-all duration-300">
      {/* Header only on dashboard */}
      {activeTab === "dashboard" && <Header />}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto pb-24 transition-all duration-300 w-full md:max-w-5xl lg:max-w-7xl mx-auto md:border-x md:shadow-xl bg-[#0a0a0a]`}>
        <div className="h-full px-4 sm:px-6 lg:px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onTabClick={(tabId) => {
          if (tabId === "dgtnz") {
            setSelectedFeatureMode("fraud");
            handleTabClick("dgtnz");
            return;
          }
          handleTabClick(tabId);
        }}
        getActiveTabId={getActiveTabId}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default MainLayout;