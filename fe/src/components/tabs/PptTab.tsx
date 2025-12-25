import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Presentation, Sparkles, Loader2, ImagePlus, X, History, Wand2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface PptTabProps {
    onBack: () => void;
}

interface ScanRecord {
    id: number;
    original_filename: string;
    extracted_text: string;
    confidence_score: number;
    created_at: string;
}

const PptTab = ({ onBack }: PptTabProps) => {
    const [prompt, setPrompt] = useState("");
    const [images, setImages] = useState<string[]>([]); // Base64 strings
    const [isGenerating, setIsGenerating] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [theme, setTheme] = useState("modern");
    const [result, setResult] = useState<{ download_url: string, preview_url: string, pptx_filename: string } | null>(null);
    const [pptHistory, setPptHistory] = useState<any[]>([]);

    const THEMES = [
        { id: "modern", name: "Modern (Dark Blue)", color: "#1a237e" },
        { id: "professional", name: "Professional (Gray)", color: "#212121" },
        { id: "creative", name: "Creative (Pink)", color: "#880e4f" },
        { id: "eco", name: "Eco (Green)", color: "#1b5e20" },
        { id: "sunset", name: "Sunset (Orange)", color: "#bf360c" },
        { id: "ocean", name: "Ocean (Teal)", color: "#006064" },
        { id: "minimalist", name: "Minimalist (Black/White)", color: "#424242" },
        { id: "global", name: "Global (Navy)", color: "#0d47a1" },
        { id: "tech", name: "Tech (Dark)", color: "#263238" },
        { id: "luxury", name: "Luxury (Gold)", color: "#d4af37" },
        { id: "vibrant", name: "Vibrant (Purple)", color: "#311b92" },
        { id: "calm", name: "Calm (Pastel)", color: "#004d40" },
        { id: "energetic", name: "Energetic (Yellow)", color: "#fbc02d" },
        { id: "trust", name: "Trust (Blue)", color: "#01579b" },
        { id: "innovation", name: "Innovation (Indigo)", color: "#303f9f" },
        { id: "harmony", name: "Harmony (Green)", color: "#2e7d32" },
        { id: "bold", name: "Bold (Red)", color: "#b71c1c" },
        { id: "elegant", name: "Elegant (Cream)", color: "#5e0d14" },
        { id: "cyberpunk", name: "Cyberpunk (Neon)", color: "#ff00ff" },
        { id: "autumn", name: "Autumn (Brown)", color: "#3e2723" }
    ];

    // Fetch PPT history on component mount
    const fetchPptHistory = async () => {
        try {
            const { supabase } = await import("@/lib/supabaseClient");
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const response = await fetch(`${API_BASE_URL}/api/ppt/history`, {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setPptHistory(data.records || []);
            }
        } catch (error) {
            console.error("Failed to fetch PPT history:", error);
        }
    };

    // Load history on mount
    useEffect(() => {
        fetchPptHistory();
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (images.length + files.length > 2) {
            toast.error("Max 2 images allowed");
            return;
        }

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a topic or prompt");
            return;
        }

        setIsGenerating(true);
        toast.loading("Generating presentation with AI...");

        try {
            const { supabase } = await import("@/lib/supabaseClient");
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                toast.error("Login required");
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/ppt/generate-prompt`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    prompt: prompt,
                    images: images,
                    theme: theme
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Generation failed");
            }

            const data = await response.json();
            setResult(data);
            toast.dismiss();
            toast.success("✅ Presentation Ready!");

            // Refresh PPT history
            fetchPptHistory();

            // Reset form (keep result visible)
            setPrompt("");
            setImages([]);

        } catch (error: any) {
            toast.dismiss();
            toast.error(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-semibold">ppt.wtf</h2>
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full">
                            Premium
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Generate slides from text & images
                    </p>
                </div>
            </div>

            <Card className="p-4 sm:p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500 rounded-lg">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm sm:text-base mb-1">
                            AI Presentation Generator
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Describe what you want, upload reference images (optional), and let AI build your slides.
                        </p>
                    </div>
                </div>
            </Card>

            {result && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-500 rounded-xl space-y-3"
                >
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Sparkles className="h-5 w-5" />
                        <h3 className="font-bold">✨ Presentasi Premium Anda Siap!</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Presentasi profesional Anda telah berhasil dibuat dengan kualitas super premium. Klik tombol di bawah untuk melihat preview.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white gap-2 flex-1"
                            size="lg"
                            onClick={() => {
                                const previewUrl = `/ppt/preview?url=${encodeURIComponent(result.preview_url)}&filename=${encodeURIComponent(result.pptx_filename)}&download=${encodeURIComponent(result.download_url)}`;
                                window.location.href = previewUrl;
                            }}
                        >
                            <Presentation className="h-4 w-4" />
                            Preview Presentation
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResult(null)}
                            className="text-xs"
                        >
                            Buat Baru
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Main Generation Form */}
            <Card className="p-4 sm:p-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Layout Theme</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="col-span-full p-2 rounded-md border bg-background text-sm"
                        >
                            {THEMES.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Presentation Topic / Prompt</label>
                    <Textarea
                        placeholder="E.g. Create a pitch deck for a coffee shop business. key points: market analysis, financial projections..."
                        className="min-h-[120px] resize-none"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between">
                        <span>Reference Images (Optional)</span>
                        <span className="text-muted-foreground text-xs">{images.length}/2</span>
                    </label>

                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative w-20 h-20 shrink-0">
                                <img src={img} alt="ref" className="w-full h-full object-cover rounded-lg border" />
                                <button
                                    onClick={() => removeImage(idx)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {images.length < 2 && (
                            <label className="w-20 h-20 shrink-0 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground mt-1">Add Image</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        )}
                    </div>
                </div>

                <Button
                    className="w-full h-11 text-base gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating Magic...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-4 h-4" />
                            Generate Presentation (1 Credit)
                        </>
                    )}
                </Button>
            </Card>

            {/* PPT History Section */}
            {pptHistory.length > 0 && (
                <Card className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">📚 Your PPT History</h3>
                        <span className="text-xs text-muted-foreground">{pptHistory.length} presentation{pptHistory.length > 1 ? 's' : ''}</span>
                    </div>

                    <div className="grid gap-3">
                        {pptHistory.map((ppt: any) => {
                            const expiresAt = new Date(ppt.expires_at);
                            const now = new Date();
                            const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                            return (
                                <motion.div
                                    key={ppt.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm truncate" title={ppt.title}>{ppt.title}</h4>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                    {ppt.theme}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(ppt.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </span>
                                                {daysLeft <= 2 && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                        {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-8"
                                                onClick={() => {
                                                    const previewUrl = `/ppt/preview?url=${encodeURIComponent(ppt.pdf_url)}&filename=${encodeURIComponent(ppt.pdf_filename)}&download=${encodeURIComponent(ppt.pdf_url)}`;
                                                    window.location.href = previewUrl;
                                                }}
                                            >
                                                <Presentation className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">Preview</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                asChild
                                            >
                                                <a href={ppt.pdf_url} download={ppt.pdf_filename}>
                                                    <Download className="h-3.5 w-3.5" />
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default PptTab;
