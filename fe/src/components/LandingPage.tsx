import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan, Zap, Shield, Cloud, Check, ArrowRight, Brain, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface LandingPageProps {
  onLogin: () => void;
}

interface Review {
  id: number;
  user_name: string;
  rating: number;
  feedback: string;
}

const LandingPage = ({ onLogin }: LandingPageProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    // Only fetch if needed, fail gracefully
    fetch(`${API_BASE_URL}/api/reviews/recent`)
      .then(res => res.json())
      .then(data => setReviews(data))
      .catch(() => setReviews([]));
  }, []);

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI Precision",
      desc: "Powered by advanced LLMs (OpenAI & Groq) to correct typos and format text perfectly."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast",
      desc: "Optimized Tesseract engine + Groq fallback ensures results in seconds."
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: "Google Drive Sync",
      desc: "Automatically save every scan to your personal Google Drive."
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Secure & Private",
      desc: "Your data is yours. We process it and forget it. Zero retention."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white selection:text-black font-sans overflow-x-hidden">

      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/30 blur-[120px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scan className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tighter">ocr.wtf</span>
          </div>
          <Button
            variant="outline"
            className="border-white/20 text-black hover:bg-white hover:text-black transition-colors rounded-full px-6"
            onClick={onLogin}
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-32 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-gray-400 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>v2.0 Now Available</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]">
              Document Intelligence <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                Reimagined.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Transform physical documents into actionable digital data instantly.
              Powered by state-of-the-art AI for unmatched accuracy.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={onLogin}
                className="w-full sm:w-auto h-14 px-8 text-lg bg-white text-black hover:bg-gray-200 rounded-full font-medium"
              >
                Start Scanning <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onLogin} // Redirect to login for demo too for now
                className="w-full sm:w-auto h-14 px-8 text-lg border-white/20 hover:bg-white/10 text-white rounded-full bg-transparent"
              >
                View Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* UI Showcase / Tilt Card */}
      <section className="relative z-10 pb-32 px-6 overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotateX: 20 }}
            whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-blue-900/20 overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="p-8 md:p-12 grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-bold">Smart Extraction</h3>
                <div className="space-y-4">
                  {[
                    "Auto-detects document boundaries",
                    "Corrects OCR errors with GPT-4o",
                    "Formats unstructured data into JSON",
                    "Syncs directly to your workspace"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-gray-400">
                      <Check className="w-5 h-5 text-blue-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Mock UI */}
              <div className="rounded-lg border border-white/10 bg-black/50 p-4 aspect-video relative group">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-3/4 bg-white/10 rounded animate-pulse" />
                  <div className="h-2 w-1/2 bg-white/10 rounded animate-pulse delay-75" />
                  <div className="h-2 w-5/6 bg-white/10 rounded animate-pulse delay-150" />
                </div>
                <div className="absolute bottom-4 right-4 bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded border border-blue-500/30">
                  Processing: 98%
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-32 bg-white/[0.02] border-t border-white/5">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Built for Modern Teams</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Stop wasting hours on manual data entry. Let AI handle the heavy lifting.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full bg-[#111] border-white/10 hover:border-white/20 transition-colors p-6">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-6 text-white">
                    {f.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/10 bg-[#050505]">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-gray-400" />
            <span className="font-bold text-gray-400 text-sm">ocr.wtf &copy; 2025</span>
          </div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-white transition-colors">GitHub</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
