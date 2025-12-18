import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* --- HALAMAN PUBLIK --- */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* --- HALAMAN UTAMA (JANGAN PAKAI PROTECTED ROUTE) --- */}
          {/* Biarkan Index.tsx yang mengecek login sendiri */}
          <Route path="/dashboard" element={<Index />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />

          {/* --- ROUTE BAWAAN --- */}
          {/* Kalau buka root, lempar ke dashboard (biar dashboard yang nendang kalau belum login) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Catch-all: Kalau nyasar, ke Landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
