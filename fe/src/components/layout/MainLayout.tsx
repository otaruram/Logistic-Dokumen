import { motion, AnimatePresence } from "framer-motion";
import Header from "./Header";
import DashboardTab from "../tabs/DashboardTab";
import FeaturesDropup from "../tabs/FeaturesDropup";
import PptTab from "../tabs/PptTab";
import DgtnzTab from "../tabs/DgtnzTab";
import AuditTab from "../tabs/AuditTab";
import PdfTab from "../tabs/PdfTab";
import QuizTab from "../tabs/QuizTab";
import OptionsTab from "../tabs/OptionsTab";
import ProfileTab from "../tabs/ProfileTab";
import BottomNavigation from "../ui/bottom-navigation";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

import { useDevice } from "@/context/DeviceContext";

const MainLayout = () => {
  const { deviceMode } = useDevice(); // Consume context

  const {
    activeTab,
    showFeaturesDropup,
    setActiveTab,
    setShowFeaturesDropup,
    handleTabClick,
    handleFeatureSelect,
    getActiveTabId,
  } = useTabNavigation();

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;
      case "ppt":
        return <PptTab onBack={() => setActiveTab("dashboard")} />;
      case "dgtnz":
        return <DgtnzTab onBack={() => setActiveTab("dashboard")} />;
      case "invoice":
        return <AuditTab onBack={() => setActiveTab("dashboard")} />;
      case "compressor":
        return <PdfTab onBack={() => setActiveTab("dashboard")} />;
      case "quiz":
        return <QuizTab onBack={() => setActiveTab("dashboard")} />;
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
    switch (deviceMode) {
      case 'mobile': return 'max-w-lg mx-auto border-x'; // Default mobile look
      case 'tablet': return 'max-w-3xl mx-auto border-x shadow-xl'; // Tablet width
      case 'desktop': return 'w-full max-w-7xl mx-auto px-8'; // Desktop full width constrained
      default: return 'max-w-lg mx-auto';
    }
  };

  return (
    <div className={`min-h-screen bg-background flex flex-col transition-all duration-300 ${deviceMode === 'desktop' ? 'bg-gray-50' : ''}`}>
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

      {/* Features Dropup Menu */}
      <AnimatePresence>
        {showFeaturesDropup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/20 z-40"
              onClick={() => setShowFeaturesDropup(false)}
            />
            <FeaturesDropup
              onSelect={handleFeatureSelect}
              onClose={() => setShowFeaturesDropup(false)}
            />
          </>
        )}
      </AnimatePresence>

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