import { useState, useEffect, useCallback, useRef } from "react";
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
 * State is persisted to sessionStorage so that navigating between
 * pages (e.g. /partner → /) does NOT reset the user back to the
 * landing page.  A hard refresh (Ctrl+Shift+R) still works because
 * sessionStorage survives it; but if the Supabase session has
 * expired the user will be sent back to the landing page naturally.
 */
type PageView = "landing" | "login" | "auth_check" | "phone_onboarding" | "app";

const VIEW_STORAGE_KEY = "otaru_current_view";

function persistView(view: PageView) {
  try { sessionStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
}

function readPersistedView(): PageView | null {
  try {
    const v = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "app" || v === "phone_onboarding") return v;
  } catch { /* ignore */ }
  return null;
}

function clearPersistedView() {
  try { sessionStorage.removeItem(VIEW_STORAGE_KEY); } catch { /* ignore */ }
}

const Index = () => {
  // On mount, try to restore the persisted view so we skip the
  // landing → auth_check flash when the user simply navigated away
  // and came back.
  const [currentView, setCurrentView] = useState<PageView>(() => {
    const persisted = readPersistedView();
    return persisted ?? "landing";
  });
  const [loading, setLoading] = useState(true);
  const authCheckDone = useRef(false);

  // Wrapper that also persists
  const changeView = useCallback((view: PageView) => {
    setCurrentView(view);
    if (view === "app" || view === "phone_onboarding") {
      persistView(view);
    } else if (view === "landing") {
      clearPersistedView();
    }
  }, []);

  /**
   * Check user's onboarding status via the whitelist auth endpoint.
   *
   * Flow:
   *   1. Call GET /api/v1/auth/me with Bearer token
   *   2. If is_active && !needs_onboarding → go to app
   *   3. If needs_onboarding → show phone onboarding page
   *   4. On error → fallback to app (graceful degradation)
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        changeView("landing");
        return;
      }

      const res = await fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const status = await res.json();
        if (status.is_active && !status.needs_onboarding) {
          changeView("app");
        } else {
          changeView("phone_onboarding");
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
            changeView(kycStatus.kyc_verified ? "app" : "phone_onboarding");
          } else {
            // Both endpoints failed — allow access (graceful fallback)
            console.warn("Both auth checks failed, allowing access");
            changeView("app");
          }
        } catch {
          console.warn("Legacy KYC check also failed, allowing access");
          changeView("app");
        }
      }
    } catch (err) {
      console.warn("Auth check error, allowing access:", err);
      changeView("app");
    }
  }, [changeView]);

  useEffect(() => {
    let mounted = true;

    const handleAuth = (session: any) => {
      if (!mounted) return;

      if (session) {
        console.log("✅ Login Berhasil:", session.user.email);

        // If we already have a persisted "app" view AND a valid session,
        // skip the full auth check to avoid flash/reset.
        const persisted = readPersistedView();
        if (persisted === "app" && !authCheckDone.current) {
          authCheckDone.current = true;
          setCurrentView("app");
          setLoading(false);
          // Still verify auth status in the background (silently).
          // If it turns out onboarding is needed, it will update.
          checkAuthStatus();
          return;
        }

        // First time or no persisted view — do full auth check
        setCurrentView("auth_check");
        checkAuthStatus();
      } else {
        console.log("❌ Tidak ada sesi / Login Gagal");
        changeView("landing");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <LandingPage onLogin={() => changeView("login")} />;
  }

  if (currentView === "login") {
    return (
      <LoginPage
        onBack={() => changeView("landing")}
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
        onComplete={() => changeView("app")}
        onBack={() => changeView("landing")}
      />
    );
  }

  return <MainLayout />;
};

export default Index;
