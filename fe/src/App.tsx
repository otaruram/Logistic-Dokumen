import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfigErrorPage } from "@/components/ConfigErrorPage";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

import { DeviceProvider } from "@/context/DeviceContext"; // Import Provider
import Help from "./pages/Help";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";

const App = () => {
  // Show error page if Supabase is not configured
  if (!isSupabaseConfigured) {
    return <ConfigErrorPage />;
  }

  return (
    <DeviceProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/help" element={<Help />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </DeviceProvider>
  );
};

export default App;
