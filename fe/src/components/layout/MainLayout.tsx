import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "./Header";
import DashboardTab from "../tabs/DashboardTab";
import DgtnzTab from "../tabs/DgtnzTab";
import ProfileTab from "../tabs/ProfileTab";
import OtaruChatPage from "@/pages/OtaruChatPage";
import AdminTab from "../tabs/AdminTab";
import BottomNavigation from "../ui/bottom-navigation";
import { useTabNavigation } from "@/hooks/use-tab-navigation";
import { ShieldAlert, FileCheck } from "lucide-react";

const ADMIN_EMAIL = "okitr52@gmail.com";

const MainLayout = () => {
  const {
    activeTab,
    handleTabClick,
    getActiveTabId,
  } = useTabNavigation();

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedFeatureMode, setSelectedFeatureMode] = useState<"default" | "fraud">("default");
  const [showFeaturePopup, setShowFeaturePopup] = useState(false);

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
            setShowFeaturePopup(true);
            return;
          }
          handleTabClick(tabId);
        }}
        getActiveTabId={getActiveTabId}
        isAdmin={isAdmin}
      />

      <AnimatePresence>
        {showFeaturePopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[60]"
              onClick={() => setShowFeaturePopup(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[92%] max-w-md rounded-2xl border border-white/15 bg-[#0b0b0b] p-5"
            >
              <h3 className="text-lg font-bold text-white">Pilih Feature</h3>
              <p className="text-xs text-gray-400 mt-1">Pilih mode scan yang ingin digunakan.</p>

              <div className="grid grid-cols-1 gap-3 mt-4">
                <button
                  onClick={() => {
                    setSelectedFeatureMode("default");
                    setShowFeaturePopup(false);
                    handleTabClick("dgtnz");
                  }}
                  className="w-full text-left rounded-xl border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-colors p-4"
                >
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-white" />
                    <span className="font-semibold text-white">Dokumen</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Scan dokumen standar dengan OCR.</p>
                </button>

                <button
                  onClick={() => {
                    setSelectedFeatureMode("fraud");
                    setShowFeaturePopup(false);
                    handleTabClick("dgtnz");
                  }}
                  className="w-full text-left rounded-xl border border-red-500/30 hover:border-red-400/60 bg-red-500/10 hover:bg-red-500/15 transition-colors p-4"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span className="font-semibold text-red-300">Deteksi Fraud</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Deteksi anomali + validasi field kritikal.</p>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainLayout;