import { ArrowLeft, BookOpen, Cpu, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Docs = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto pb-16"
            >
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-8 pl-0 hover:bg-transparent text-gray-400 hover:text-white transition-colors gap-2"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                </Button>

                <div className="mb-12">
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Otaru Dokumentasi</h1>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Pelajari cara kerja OtaruChain & OtaruFinancial dalam mendeteksi fraud, menganalisis kelayakan kredit, dan mengekstrak data dari dokumen.
                    </p>
                </div>

                <div className="space-y-12">
                    {/* Cara Kerja */}
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Zap className="text-emerald-400 w-6 h-6" /> Cara Kerja
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 border border-white/10 rounded-2xl bg-[#111]">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20">
                                    <span className="text-blue-400 font-bold">1</span>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Unggah & OCR</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Dokumen (KTP, Slip Gaji, Surat Jalan, dll) diunggah oleh user. AI langsung membaca dan mengekstrak teks menggunakan teknologi OCR.
                                </p>
                            </div>
                            <div className="p-6 border border-white/10 rounded-2xl bg-[#111]">
                                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                                    <span className="text-red-400 font-bold">2</span>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Deteksi Penipuan</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Dokumen dianalisis oleh Gemini untuk mendeteksi manipulasi (Dimanipulasi), blur, pencahayaan buruk, atau anomali pada gambar.
                                </p>
                            </div>
                            <div className="p-6 border border-white/10 rounded-2xl bg-[#111]">
                                <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 border border-yellow-500/20">
                                    <span className="text-yellow-400 font-bold">3</span>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Decision Engine</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Otaru AI menghitung rasio hutang (DSR), skor kredit, dan memberikan rekomendasi (Aman/Risiko/Tolak) sesuai standar BI & OJK.
                                </p>
                            </div>
                            <div className="p-6 border border-white/10 rounded-2xl bg-[#111]">
                                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
                                    <span className="text-green-400 font-bold">4</span>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Approval Queue</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Semua data masuk ke dashboard admin untuk diverifikasi akhir. Admin memberikan stempel "Approved" atau "Rejected".
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Technologies */}
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Cpu className="text-purple-400 w-6 h-6" /> Teknologi
                        </h2>
                        <div className="space-y-4">
                            <div className="p-5 border border-white/10 rounded-2xl bg-gradient-to-r from-[#111] to-transparent">
                                <h3 className="font-semibold text-lg mb-1">Frontend</h3>
                                <p className="text-sm text-gray-400">React.js, TypeScript, Vite, Tailwind CSS, Framer Motion.</p>
                            </div>
                            <div className="p-5 border border-white/10 rounded-2xl bg-gradient-to-r from-[#111] to-transparent">
                                <h3 className="font-semibold text-lg mb-1">Backend</h3>
                                <p className="text-sm text-gray-400">Python (FastAPI), Uvicorn, Docker, PostgreSQL (Supabase).</p>
                            </div>
                            <div className="p-5 border border-white/10 rounded-2xl bg-gradient-to-r from-[#111] to-transparent">
                                <h3 className="font-semibold text-lg mb-1">Artificial Intelligence</h3>
                                <p className="text-sm text-gray-400">Google Gemini 2.5 Flash (Deteksi Penipuan & Recommendation), GPT-4o, Advanced OCR.</p>
                            </div>
                            <div className="p-5 border border-white/10 rounded-2xl bg-gradient-to-r from-[#111] to-transparent">
                                <h3 className="font-semibold text-lg mb-1">Automation & Bots</h3>
                                <p className="text-sm text-gray-400">Telegram Bot API (Otaru AI Assistant & Financial Notifications).</p>
                            </div>
                        </div>
                    </section>
                </div>
            </motion.div>
        </div>
    );
};

export default Docs;
