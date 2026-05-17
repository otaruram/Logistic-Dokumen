import { useState, useEffect } from "react";
import LandingPage from "@/components/LandingPage";
import LoginPage from "@/components/LoginPage";
import KycVerificationForm from "@/components/KycVerificationForm";
import MainLayout from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";

const API = APP_CONFIG.apiUrl;

type PageView = "landing" | "login" | "kyc_check" | "kyc_form" | "app";

const Index = () => {
  const [currentView, setCurrentView] = useState<PageView>("landing");
  const [loading, setLoading] = useState(true);

  const checkKycStatus = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setCurrentView("landing"); return; }

      const res = await fetch(`${API}/api/kyc/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const status = await res.json();
        setCurrentView(status.kyc_verified ? "app" : "kyc_form");
      } else {
        // If KYC endpoint not available, let user through (graceful fallback)
        console.warn("KYC status check failed, allowing access");
        setCurrentView("app");
      }
    } catch (err) {
      console.warn("KYC check error, allowing access:", err);
      setCurrentView("app");
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleAuth = (session: any) => {
      if (!mounted) return;

      if (session) {
        console.log("✅ Login Berhasil:", session.user.email);
        // Check KYC status before showing app
        setCurrentView("kyc_check");
        checkKycStatus();
      } else {
        console.log("❌ Tidak ada sesi / Login Gagal");
        setCurrentView("landing");
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuth(session);
    });

    if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        handleAuth(session);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuth(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading || currentView === "kyc_check") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  if (currentView === "landing") {
    return <LandingPage onLogin={() => setCurrentView("login")} />;
  }

  if (currentView === "login") {
    return (
      <LoginPage
        onBack={() => setCurrentView("landing")}
        onSuccess={() => {
          setCurrentView("kyc_check");
          checkKycStatus();
        }}
      />
    );
  }

  if (currentView === "kyc_form") {
    return <KycVerificationForm onComplete={() => setCurrentView("app")} />;
  }

  return <MainLayout />;
};

export default Index;
