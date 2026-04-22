import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import Header from "./Header";
import DashboardTab from "../tabs/DashboardTab";
import DgtnzTab from "../tabs/DgtnzTab";
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

  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedFeatureMode, setSelectedFeatureMode] = useState<"default" | "fraud">("fraud");
  const [showPartnerPopup, setShowPartnerPopup] = useState(false);

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

    // Check if user came from partner login flow
    if (localStorage.getItem("redirect_to_partner") === "1") {
      setShowPartnerPopup(true);
    }
  }, []);

  function handleGoToPartner() {
    localStorage.removeItem("redirect_to_partner");
    setShowPartnerPopup(false);
    navigate("/partner");
  }

  function handleDismissPartnerPopup() {
    localStorage.removeItem("redirect_to_partner");
    setShowPartnerPopup(false);
  }

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

      {/* Partner redirect popup */}
      <AnimatePresence>
        {showPartnerPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-400">Login Berhasil</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Lanjut ke Otaru Partner?</h3>
                </div>
                <button
                  onClick={handleDismissPartnerPopup}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                Kamu login dari halaman Partner. Klik tombol di bawah untuk lanjut ke Partner Portal — kelola API key, docs, dan pricing.
              </p>
              <button
                onClick={handleGoToPartner}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-colors"
              >
                Buka Partner Portal <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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