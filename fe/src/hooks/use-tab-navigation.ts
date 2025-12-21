import { useState, useCallback } from "react";
import { TabType, FeatureType } from "@/types";

export const useTabNavigation = (initialTab: TabType = "dashboard") => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showFeaturesDropup, setShowFeaturesDropup] = useState(false);

  const handleTabClick = useCallback((tabId: string) => {
    if (tabId === "features") {
      setShowFeaturesDropup((prev) => !prev);
    } else {
      setShowFeaturesDropup(false);
      setActiveTab(tabId as TabType);
    }
  }, []);

  const handleFeatureSelect = useCallback((feature: FeatureType) => {
    setShowFeaturesDropup(false);
    setActiveTab(feature);
  }, []);

  const getActiveTabId = useCallback(() => {
    if (activeTab === "dgtnz" || activeTab === "invoice") return "features";
    return activeTab;
  }, [activeTab]);

  return {
    activeTab,
    showFeaturesDropup,
    setActiveTab,
    setShowFeaturesDropup,
    handleTabClick,
    handleFeatureSelect,
    getActiveTabId,
  };
};
