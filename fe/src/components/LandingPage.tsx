import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Scan, Zap, Shield, Cloud, Check, ArrowRight, Brain, Lock, Star, Quote, User,
  FileSearch, MessageSquare, BarChart3, FileText, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

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
    fetch(`${API_BASE_URL}/api/reviews/recent`)
      .then(res => res.json())
      .then(data => setReviews(data))
      .catch(() => setReviews([]));
  }, []);

  const features = [
    {
      icon: <Scan className="w-6 h-6" />,
      title: "DGTNZ Scanner",
      desc: "AI-powered OCR that extracts text from receipts, invoices, and logistics documents with 98%+ accuracy.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Fraud Detection",
      desc: "Verify document authenticity with cryptographic hashing. Instantly detect tampered or modified documents.",
      color: "from-red-500 to-orange-500"
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Otaru AI Chatbot",
      desc: "Upload documents and ask questions in natural language. Supports images, PDFs, and DOCX files.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Financial Analysis",
      desc: "Auto-extract structured financial data: amounts, dates, clients, invoice numbers — ready for analysis.",
      color: "from-emerald-500 to-green-500"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast",
      desc: "Optimized Tesseract + GPT-4o pipeline processes documents in seconds, not minutes.",
      color: "from-yellow-500 to-amber-500"
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: "Google Drive Sync",
      desc: "Export scan results directly to your personal Google Drive for safekeeping and easy access.",
      color: "from-sky-500 to-blue-500"
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Privacy First",
      desc: "Zero data retention. Files processed in memory and discarded after analysis. Your documents stay yours.",
      color: "from-gray-400 to-gray-600"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Invoice Generator",
      desc: "Create professional invoices with auto-filled data from your scans. Export as PDF in one click.",
      color: "from-violet-500 to-indigo-500"
    }
  ];

  const steps = [
    { num: "01", title: "Upload", desc: "Take a photo or upload any document — receipt, invoice, or surat jalan." },
    { num: "02", title: "AI Analyzes", desc: "Our AI extracts text, detects fraud, and structures financial data automatically." },
    { num: "03", title: "Get Results", desc: "View digitized data, verify authenticity, export to Drive, or generate invoices." },
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
            <img src="/1.png" alt="OCR.WTF Logo" className="w-7 h-7 object-contain" />
            <span className="font-bold text-xl tracking-tighter">ocr.wtf</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/partner"
              className="hidden sm:inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
            >
              Partner API
            </Link>
            <Button
              variant="outline"
              className="border-white/20 text-black hover:bg-white hover:text-black transition-colors rounded-full px-6"
              onClick={onLogin}
            >
              Sign In
            </Button>
          </div>
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
              <span>Free Forever · 10 Credits/Day</span>
            </div>

            <div className="mb-6 flex justify-center">
              <Link
                to="/partner"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                Partner area for API key, billing, and credit scoring
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]">
              Scan. Verify. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                Trust Your Documents.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              AI-powered document intelligence for Indonesia. Scan receipts, detect fraud on invoices,
              chat with your documents, and generate professional invoices — all in one platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={onLogin}
                className="w-full sm:w-auto h-14 px-8 text-lg bg-white text-black hover:bg-gray-200 rounded-full font-medium"
              >
                Start Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="w-full sm:w-auto h-14 px-8 text-lg border-white/20 hover:bg-white/10 text-white rounded-full bg-transparent"
              >
                <Link to="/partner">Explore Partner API</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mt-12 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>End-to-End Secure</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>GPT-4o Powered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero Data Retention</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-24 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">How It Works</h2>
            <p className="text-gray-400 text-lg">Three steps to digitize and verify your documents</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{step.num}</span>
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* UI Showcase */}
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
                  <FileSearch className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-bold">Smart Document Intelligence</h3>
                <div className="space-y-4">
                  {[
                    "Extracts text from photos, PDFs, and scanned docs",
                    "AI corrects OCR errors for 98%+ accuracy",
                    "Detects fraud with cryptographic verification",
                    "Structures data into exportable JSON format",
                    "Chat with your documents via Otaru AI"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-gray-400">
                      <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
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
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="h-2 w-20 bg-green-500/20 rounded" />
                    <span className="text-[10px] text-green-400">Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="h-2 w-16 bg-yellow-500/20 rounded" />
                    <span className="text-[10px] text-yellow-400">Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="h-2 w-24 bg-red-500/20 rounded" />
                    <span className="text-[10px] text-red-400">Tampered</span>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded border border-blue-500/30">
                  Fraud Detection: Active
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="relative z-10 py-24 px-6 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="container mx-auto max-w-6xl relative">
            <div className="text-center mb-16">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Trusted by Professionals</h2>
                <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                  See what others are saying about the future of document processing.
                </p>
              </motion.div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {reviews.map((review, i) => (
                <motion.div key={review.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className="h-full p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:bg-white/[0.05] transition-colors relative group">
                    <Quote className="absolute top-6 right-6 w-8 h-8 text-white/5 group-hover:text-white/10 transition-colors" />
                    <div className="flex items-center gap-1 text-yellow-500 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-yellow-500" : "fill-transparent opacity-30"}`} />
                      ))}
                    </div>
                    <p className="text-gray-300 mb-8 leading-relaxed">"{review.feedback}"</p>
                    <div className="flex items-center gap-4 mt-auto">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {review.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{review.user_name}</p>
                        <p className="text-xs text-gray-500">Verified User</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Grid (8 Features) */}
      <section className="relative z-10 py-32 bg-white/[0.02] border-t border-white/5">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything You Need</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              From scanning to fraud detection, chatbot analysis to invoice generation —
              one platform for all your document needs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="h-full bg-[#111] border-white/10 hover:border-white/20 transition-all duration-300 p-6 group hover:translate-y-[-2px]">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${f.color} opacity-20 group-hover:opacity-30 flex items-center justify-center mb-6 transition-opacity`}>
                    <div className="text-white">{f.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
              Ready to Digitize Your Documents?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Join thousands of users who trust ocr.wtf for document scanning, fraud detection, and AI-powered analysis. Free forever.
            </p>
            <Button
              size="lg"
              onClick={onLogin}
              className="h-14 px-10 text-lg bg-white text-black hover:bg-gray-200 rounded-full font-medium"
            >
              Get Started — It's Free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/10 bg-[#050505]">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/1.png" alt="OCR.WTF Logo" className="w-5 h-5 object-contain" />
            <span className="font-bold text-gray-400 text-sm">ocr.wtf &copy; 2025</span>
          </div>
          <div className="text-xs text-gray-600 text-center">
            AI-Powered Document Intelligence · OCR Scanner · Fraud Detection · Invoice Generator
          </div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <button onClick={onLogin} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              Sign In
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
