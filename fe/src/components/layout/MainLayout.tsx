import { motion, AnimatePresence } from "framer-motion";
import Header from "./Header";
import DashboardTab from "../tabs/DashboardTab";
import FeaturesDropup from "../tabs/FeaturesDropup";
import DgtnzTab from "../tabs/DgtnzTab";
import InvoiceTab from "../tabs/InvoiceTab";
import PdfTab from "../tabs/PdfTab";
import QuizTab from "../tabs/QuizTab";
import CommunityTab from "../tabs/CommunityTab";
import OptionsTab from "../tabs/OptionsTab";
import ProfileTab from "../tabs/ProfileTab";
import BottomNavigation from "../ui/bottom-navigation";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

const MainLayout = () => {
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
      case "dgtnz":
        return <DgtnzTab onBack={() => setActiveTab("dashboard")} />;
      case "invoice":
        return <InvoiceTab onBack={() => setActiveTab("dashboard")} />;
      case "compressor":
        return <PdfTab onBack={() => setActiveTab("dashboard")} />;
      case "quiz":
        return <QuizTab onBack={() => setActiveTab("dashboard")} />;
      case "community":
        return <CommunityTab />;
      case "options":
        return <OptionsTab />;
      case "profile":
        return <ProfileTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header only on dashboard */}
      {activeTab === "dashboard" && <Header />}
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="max-w-lg mx-auto py-6"
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