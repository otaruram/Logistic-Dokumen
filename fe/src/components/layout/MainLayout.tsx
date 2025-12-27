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
    <div className="min-h-screen bg-background flex flex-col transition-all duration-300">
      {/* Header only on dashboard */}
      {activeTab === "dashboard" && <Header />}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto pb-24 px-4 transition-all duration-300 ${getContainerClass()}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="py-6 h-full"
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
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