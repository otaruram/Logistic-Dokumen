import { motion, AnimatePresence } from "framer-motion";
import Header from "./Header";
import DashboardTab from "../tabs/DashboardTab";
import DgtnzTab from "../tabs/DgtnzTab";
import OptionsTab from "../tabs/OptionsTab";
import ProfileTab from "../tabs/ProfileTab";
import BottomNavigation from "../ui/bottom-navigation";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

const MainLayout = () => {
  const {
    activeTab,
    setActiveTab,
    handleTabClick,
    getActiveTabId,
  } = useTabNavigation();


  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;
      case "dgtnz":
        return <DgtnzTab onBack={() => setActiveTab("dashboard")} />;
      case "options":
        return <OptionsTab />;
      case "profile":
        return <ProfileTab />;
      default:
        return <DashboardTab />;
    }
  };


  // Dynamic container class based on device mode
  const getContainerClass = () => {
    // Always use tablet design for consistency
    return 'max-w-3xl mx-auto border-x shadow-xl';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col transition-all duration-300">
      {/* Header only on dashboard */}
      {activeTab === "dashboard" && <Header />}

      {/* Main Content */}
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
        onTabClick={handleTabClick}
        getActiveTabId={getActiveTabId}
      />
    </div>
  );
};

export default MainLayout;