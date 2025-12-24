import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfigErrorPage } from "@/components/ConfigErrorPage";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import Index from "./pages/Index";
import QuizPlay from "./pages/QuizPlay";
import PptPreviewPage from "./pages/PptPreviewPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Show error page if Supabase is not configured
  if (!isSupabaseConfigured) {
    return <ConfigErrorPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/play/:quizId" element={<QuizPlay />} />
            <Route path="/ppt/preview" element={<PptPreviewPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
