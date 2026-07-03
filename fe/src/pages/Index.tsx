import { useState, useEffect } from "react";
import LandingPage from "@/components/LandingPage";
import LoginPage from "@/components/LoginPage";
import PhoneOnboardingPage from "@/components/PhoneOnboardingPage";
import MainLayout from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabaseClient";
import { APP_CONFIG } from "@/constants";

const API = APP_CONFIG.apiUrl;

/**
 * Page views for the auth flow:
 *   landing → login → auth_check → phone_onboarding → app
 *
 * Replaces old KYC flow (landing → login → kyc_check → kyc_form → app)
 */
type PageView = "landing" | "login" | "auth_check" | "phone_onboarding" | "app";

const Index = () => {
  const [currentView, setCurrentView] = useState<PageView>("landing");
  const [loading, setLoading] = useState(true);

  /**
   * Check user's onboarding status via the new whitelist auth endpoint.
   *
   * Flow:
   *   1. Call GET /api/v1/auth/me with Bearer token
   *   2. If is_active && !needs_onboarding → go to app
   *   3. If needs_onboarding → show phone onboarding page
   *   4. On error → fallback to app (graceful degradation)
   */
  const checkAuthStatus = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setCurrentView("landing");
        return;
      }

      const res = await fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const status = await res.json();
        if (status.is_active && !status.needs_onboarding) {
          setCurrentView("app");
        } else {
          setCurrentView("phone_onboarding");
        }
      } else {
        // If auth/me endpoint not available, fallback to old KYC check
        console.warn("Auth status check failed, trying legacy KYC endpoint...");
        try {
          const kycRes = await fetch(`${API}/api/kyc/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (kycRes.ok) {
            const kycStatus = await kycRes.json();
            setCurrentView(kycStatus.kyc_verified ? "app" : "phone_onboarding");
          } else {
            // Both endpoints failed — allow access (graceful fallback)
            console.warn("Both auth checks failed, allowing access");
            setCurrentView("app");
          }
        } catch {
          console.warn("Legacy KYC check also failed, allowing access");
          setCurrentView("app");
        }
      }
    } catch (err) {
      console.warn("Auth check error, allowing access:", err);
      setCurrentView("app");
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleAuth = (session: any) => {
      if (!mounted) return;

      if (session) {
        console.log("✅ Login Berhasil:", session.user.email);
        // Check onboarding status before showing app
        setCurrentView("auth_check");
        checkAuthStatus();
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

  // Loading / auth check spinner
  if (loading || currentView === "auth_check") {
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
          setCurrentView("auth_check");
          checkAuthStatus();
        }}
      />
    );
  }

  if (currentView === "phone_onboarding") {
    return (
      <PhoneOnboardingPage
        onComplete={() => setCurrentView("app")}
        onBack={() => setCurrentView("landing")}
      />
    );
  }

  return <MainLayout />;
};

export default Index;
