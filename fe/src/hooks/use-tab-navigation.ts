import { useState, useCallback } from "react";
import { TabType } from "@/types";

export const useTabNavigation = (initialTab: TabType = "dashboard") => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId as TabType);
  }, []);

  const getActiveTabId = useCallback(() => {
    return activeTab;
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    handleTabClick,
    getActiveTabId,
  };
};
