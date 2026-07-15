import { useState, useCallback, useEffect } from "react";
import { TabType } from "@/types";

export const useTabNavigation = (initialTab: TabType = "dashboard") => {
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const params = new URLCariParams(window.location.search);
    const tabParam = params.get("tab");
    return (tabParam as TabType) || initialTab;
  });

  // Listen for popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLCariParams(window.location.search);
      const tabParam = params.get("tab");
      setActiveTabState((tabParam as TabType) || initialTab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialTab]);

  const setActiveTab = useCallback((tabId: TabType) => {
    setActiveTabState(tabId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.pushState({}, "", url);
  }, []);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId as TabType);
  }, [setActiveTab]);

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
