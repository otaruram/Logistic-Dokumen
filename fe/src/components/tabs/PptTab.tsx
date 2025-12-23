import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Presentation, Sparkles, Loader2, ImagePlus, X, History, Wand2 } from "lucide-react";
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

    // Scans for optional history
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

    const loadScanHistory = async () => {
        if (scans.length > 0) {
            setShowHistory(!showHistory);
            return;
        }

        setIsLoadingHistory(true);
        setShowHistory(true);
        try {
            const { supabase } = await import("@/lib/supabaseClient");
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const response = await fetch(`${API_BASE_URL}/api/scans/history`, {
                headers: { "Authorization": `Bearer ${session.access_token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setScans(data.scans || []);
            }
        } catch (error) {
            console.error("Error loading history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
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
                    images: images
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Generation failed");
            }

            const data = await response.json();
            toast.dismiss();

            // Check if running on localhost
            const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

            if (isLocalhost) {
                toast.success("✅ Presentation Ready! (Downloading file...)");
                toast.info("Office Viewer cannot access localhost, so we downloaded the file instead.");
                // Download directly
                const link = document.createElement('a');
                link.href = data.download_url;
                link.download = data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                toast.success("✅ Presentation Ready!");
                window.open(data.viewer_url, '_blank');
            }

            // Reset form
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

            {/* Main Generation Form */}
            <Card className="p-4 sm:p-6 space-y-4">
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

            {/* Toggle Scan History */}
            <div className="flex justify-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadScanHistory}
                    className="gap-2 text-xs"
                >
                    <History className="w-3.5 h-3.5" />
                    {showHistory ? "Hide Scan History" : "Generate from Scan History"}
                </Button>
            </div>

            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="p-4 sm:p-6 mt-4">
                            <h3 className="font-medium mb-4 text-sm">Select from Scan History</h3>
                            {/* Scan List Logic similar to previous version... */}
                            {isLoadingHistory ? (
                                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                            ) : scans.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">No scans found.</p>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    {scans.map((scan) => (
                                        <div key={scan.id} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{scan.original_filename}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(scan.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <Button size="sm" variant="secondary" onClick={() => {
                                                setPrompt(`Generate report for document: ${scan.original_filename}\nExtracted text: ${scan.extracted_text}`);
                                                setShowHistory(false);
                                            }}>
                                                Use Data
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PptTab;
