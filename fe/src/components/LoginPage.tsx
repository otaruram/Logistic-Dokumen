import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface LoginPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

const LoginPage = ({ onBack, onSuccess }: LoginPageProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    try {
      // Use clean redirect URL (just origin, no path)
      const redirectUrl = window.location.origin;
      console.log('🔐 Initiating OAuth with redirect:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          // PAKSA Google meminta persetujuan ulang agar provider_token keluar
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // WAJIB: Memaksa layar "Izinkan Akses" muncul lagi
          },
          // Scope wajib untuk upload file ke Google Drive
          scopes: 'https://www.googleapis.com/auth/drive.file'
        },
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        toast.error('Login failed: ' + error.message);
        setIsLoading(false);
      }
      // OAuth will redirect, so we don't call onSuccess here
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      toast.error('Failed to initialize authentication');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="p-8 sm:p-10 border-2 border-gray-200">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="bg-black p-3 rounded-lg">
                <Scan className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">ocr.wtf</h1>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-3">
                Welcome Back
              </h2>
              <p className="text-gray-600">
                Sign in to access your workspace
              </p>
            </div>

            {/* Google Login Button */}
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-black text-white hover:bg-gray-800 py-6 text-base font-medium rounded-lg transition-all duration-300 mb-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </div>
              )}
            </Button>

            {/* Terms */}
            <p className="text-xs text-center text-gray-500 leading-relaxed mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy.
              We'll request access to your Google Drive for file storage.
            </p>

            {/* Security Badge */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secured with enterprise-grade encryption
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
