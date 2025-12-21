import { useState, useEffect } from "react";
import LandingPage from "@/components/LandingPage";
import LoginPage from "@/components/LoginPage";
import MainLayout from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabaseClient";

type PageView = "landing" | "login" | "app";

const Index = () => {
  const [currentView, setCurrentView] = useState<PageView>("landing");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. Fungsi untuk menangani hasil auth
    const handleAuth = (session: any) => {
      if (!mounted) return;
      
      if (session) {
        console.log("✅ Login Berhasil:", session.user.email);
        setCurrentView("app");
      } else {
        console.log("❌ Tidak ada sesi / Login Gagal");
        setCurrentView("landing");
        // Bersihkan URL yang kotor (penuh token) jika login gagal
        if (window.location.hash) {
           window.history.replaceState(null, '', window.location.pathname);
        }
      }
      setLoading(false);
    };

    // 2. Cek status awal (termasuk handle redirect dari Google)
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuth(session);
    });

    // 3. Dengarkan perubahan realtime (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuth(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
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
        onSuccess={() => setCurrentView("app")}
      />
    );
  }

  return <MainLayout />;
};

export default Index;