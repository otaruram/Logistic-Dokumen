import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-service";
import { CheckCircle2, Zap, ArrowRight, Star } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<any[]>([]);

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        if (res.ok) {
            const json = await res.json();
            if(json.status === "success" && Array.isArray(json.data)) setRatings(json.data);
        }
      } catch (e) {}
    };
    fetchRatings();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 font-sans text-slate-900 dark:text-slate-50 selection:bg-blue-100 selection:text-blue-900">
      
      {/* PROFESSIONAL NAVBAR */}
      <header className="px-6 h-20 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <span>OCR<span className="text-blue-600">.wtf</span></span>
        </div>
        <div className="flex items-center gap-4">
           <Button variant="ghost" className="font-medium text-slate-600" onClick={() => navigate("/login")}>Log In</Button>
           <Button className="font-bold rounded-full px-6" onClick={() => navigate("/login")}>
             Get Started <ArrowRight className="w-4 h-4 ml-2"/>
           </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative py-24 px-6 text-center overflow-hidden">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-100/50 dark:bg-blue-900/20 blur-[100px] rounded-full -z-10" />
           
           <div className="max-w-4xl mx-auto">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wide mb-6 border border-blue-100 dark:border-blue-800">
                🚀 AI-Powered OCR Technology
             </div>
             <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-slate-900 dark:text-white leading-tight">
               Extract Data from Images <br/>
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">In Seconds.</span>
             </h1>
             <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
               Stop typing manually. Upload receipts, invoices, or documents and let our AI convert them into structured Excel data instantly.
             </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg shadow-blue-600/20" onClick={() => navigate("/login")}>
                 Start Scanning for Free
               </Button>
               <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2" onClick={() => navigate("/login")}>
                 View Demo
               </Button>
             </div>
             
             <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-400 grayscale opacity-70">
                <span>TRUSTED BY STUDENTS</span> &bull; <span>BUSINESS OWNERS</span> &bull; <span>FREELANCERS</span>
             </div>
           </div>
        </section>

        {/* FEATURES GRID */}
        <section className="py-20 bg-slate-50 dark:bg-zinc-900/50 border-y border-slate-100 dark:border-zinc-800">
            <div className="container mx-auto px-6 max-w-6xl">
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {title: "99% Accuracy", desc: "Powered by advanced Computer Vision models to ensure precise text extraction."},
                        {title: "Instant Excel Export", desc: "Convert messy images directly into clean, organized spreadsheets."},
                        {title: "Secure Cloud Storage", desc: "Your documents are encrypted and stored safely on ImageKit & GDrive."}
                    ].map((f, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-950 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                            <p className="text-slate-500 leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* TESTIMONIALS (DATA REAL) */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">Loved by Users</h2>
                <p className="text-slate-500">See what others are saying about OCR.wtf</p>
            </div>
            
            {ratings.length === 0 ? (
              <div className="text-center p-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                 <p className="text-slate-400 font-medium">Be the first to leave a review!</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {ratings.map((rate, i) => (
                  <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 flex flex-col">
                    <div className="flex gap-1 mb-4">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className={`w-4 h-4 ${j < rate.stars ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
                        ))}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 flex-1 text-sm leading-relaxed">"{rate.message}"</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-50 dark:border-zinc-800">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                          {rate.userAvatar ? <img src={rate.userAvatar} alt="u" className="w-full h-full object-cover"/> : <span className="font-bold text-blue-600">{rate.userName?.[0]}</span>}
                      </div>
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{rate.userName || "Anonymous"}</p>
                          <p className="text-xs text-slate-400">Verified User</p>
                      </div>
                      <span className="ml-auto text-2xl">{rate.emoji}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="py-10 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="container mx-auto px-6 text-center">
            <p className="text-sm text-slate-500 font-medium">© 2025 OCR.wtf Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
