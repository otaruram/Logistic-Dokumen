import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Presentation, Sparkles, Loader2, ImagePlus, X, History, Wand2, Download, FileText, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    const [result, setResult] = useState<{ download_url: string, preview_url: string, pptx_filename: string, pptx_url: string } | null>(null);
    const [pptHistory, setPptHistory] = useState<any[]>([]);

    // Script Modal State
    const [selectedScript, setSelectedScript] = useState<{ title: string, content: string } | null>(null);

    const [language, setLanguage] = useState("Indonesian"); // Default Indonesian

    const [showAdvanced, setShowAdvanced] = useState(false);

    const LANGUAGES = [
        "Indonesian", "English", "Spanish", "French", "German",
        "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Russian",
        "Portuguese", "Italian", "Dutch", "Turkish", "Polish",
        "Swedish", "Vietnamese", "Thai", "Hindi", "Bengali"
    ];

    // Premium Themes Only
    const THEMES = [
        { id: "ai_recommended", name: "✨ AI Recommended (Auto)", color: "#000000" },
        { id: "modern", name: "Modern Blue (Clean)", color: "#1a237e" },
        { id: "minimalist", name: "Minimalist Black (Sleek)", color: "#000000" },
        { id: "corporate", name: "Corporate Gray (Professional)", color: "#212121" },
        { id: "luxury", name: "Elegant Gold (Premium)", color: "#d4af37" },
        { id: "creative", name: "Creative Pink (Vibrant)", color: "#880e4f" }
    ];

    // Scroll Container logic
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 300;
            if (direction === 'left') {
                current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

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
                    theme: theme,
                    language: language
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

            fetchPptHistory();
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
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* ... (Header remains same) */}

            {/* Generator Form */}
            <Card className="p-6 border-0 shadow-sm bg-neutral-50 dark:bg-neutral-900/50 space-y-6">

                {/* Advanced Toggle */}
                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="advanced_mode"
                        checked={showAdvanced}
                        onChange={(e) => setShowAdvanced(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    <label
                        htmlFor="advanced_mode"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                    >
                        Customize Settings (Theme & Language)
                    </label>
                </div>

                {/* Conditional Advanced Options */}
                {showAdvanced && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-hidden"
                    >
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Theme Style</label>
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                            >
                                {THEMES.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Content Language</label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                            >
                                {LANGUAGES.map(lang => (
                                    <option key={lang} value={lang}>{lang}</option>
                                ))}
                            </select>
                        </div>
                    </motion.div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium">Topic or Prompt</label>
                    <Textarea
                        placeholder="Describe your presentation topic in detail..."
                        className="min-h-[120px] resize-none focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Reference Images (Optional)</label>
                        <span className="text-xs text-muted-foreground">{images.length}/2</span>
                    </div>

                    <div className="flex gap-4">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative w-24 h-24 group">
                                <img src={img} alt="ref" className="w-full h-full object-cover rounded-lg border shadow-sm" />
                                <button
                                    onClick={() => removeImage(idx)}
                                    className="absolute -top-2 -right-2 bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {images.length < 2 && (
                            <label className="w-24 h-24 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        )}
                    </div>
                </div>

                <Button
                    className="w-full h-12 text-base font-medium bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors"
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Creating Presentation...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Generate Presentation (1 Credit)
                        </>
                    )}
                </Button>
            </Card>

            {/* Minimalist Horizontal History */}
            {pptHistory.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-semibold text-lg">History</h3>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => scroll('left')}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => scroll('right')}
                            >
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="relative group">
                        {/* Horizontal Scroll Container */}
                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {pptHistory.map((ppt: any) => (
                                <motion.div
                                    key={ppt.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="snap-start shrink-0 w-[280px] p-4 rounded-xl border bg-card hover:border-black dark:hover:border-white transition-colors"
                                >
                                    <div className="flex flex-col h-full justify-between gap-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground border px-1.5 py-0.5 rounded">
                                                    {ppt.theme}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(ppt.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            <h4 className="font-medium text-sm line-clamp-2 leading-tight mb-1" title={ppt.title}>
                                                {ppt.title}
                                            </h4>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2 border-t mt-auto">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 h-8 text-xs font-medium"
                                                onClick={() => {
                                                    const previewUrl = `/ppt/preview?url=${encodeURIComponent(ppt.pdf_url)}&filename=${encodeURIComponent(ppt.pdf_filename)}&download=${encodeURIComponent(ppt.pdf_url)}&pptx=${encodeURIComponent(ppt.pptx_url)}`;
                                                    window.location.href = previewUrl;
                                                }}
                                            >
                                                <Presentation className="w-3 h-3 mr-1.5" />
                                                Preview
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-200 dark:hover:bg-neutral-800">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => {
                                                        const link = document.createElement('a');
                                                        link.href = ppt.download_url;
                                                        link.download = ppt.pdf_filename;
                                                        link.click();
                                                    }}>
                                                        <Download className="w-4 h-4 mr-2" />
                                                        Download PDF
                                                    </DropdownMenuItem>

                                                    {/* PPTX Download */}
                                                    {ppt.pptx_url && (
                                                        <DropdownMenuItem onClick={() => {
                                                            const link = document.createElement('a');
                                                            link.href = ppt.pptx_url;
                                                            link.download = ppt.pptx_filename || "presentation.pptx";
                                                            link.click();
                                                        }}>
                                                            <Presentation className="w-4 h-4 mr-2" />
                                                            Download PPTX
                                                        </DropdownMenuItem>
                                                    )}

                                                    {/* Script Download */}
                                                    {ppt.script && (
                                                        <DropdownMenuItem onClick={() => {
                                                            const element = document.createElement("a");
                                                            const file = new Blob([ppt.script], { type: 'text/plain' });
                                                            element.href = URL.createObjectURL(file);
                                                            element.download = `${ppt.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.txt`;
                                                            document.body.appendChild(element);
                                                            element.click();
                                                            document.body.removeChild(element);
                                                            toast.success("Script downloaded!");
                                                        }}>
                                                            <FileText className="w-4 h-4 mr-2" />
                                                            Download Script (.txt)
                                                        </DropdownMenuItem>
                                                    )}

                                                    {/* Script View */}
                                                    {ppt.script && (
                                                        <DropdownMenuItem onClick={() => setSelectedScript({ title: ppt.title, content: ppt.script })}>
                                                            <FileText className="w-4 h-4 mr-2" />
                                                            View Script
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Script Modal */}
            <Dialog open={!!selectedScript} onOpenChange={(open) => !open && setSelectedScript(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{selectedScript?.title}</DialogTitle>
                        <DialogDescription>
                            AI Generated Speaker Notes & Script
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
                        <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                            {selectedScript?.content}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                            <History className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                            <span>
                                Note: This script (and the presentation) will be automatically deleted 7 days after generation.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!selectedScript) return;
                                const element = document.createElement("a");
                                const file = new Blob([selectedScript.content], { type: 'text/plain' });
                                element.href = URL.createObjectURL(file);
                                element.download = `${selectedScript.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.txt`;
                                document.body.appendChild(element);
                                element.click();
                                document.body.removeChild(element);
                                toast.success("Script downloaded!");
                            }}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download .txt
                        </Button>
                        <Button onClick={() => setSelectedScript(null)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PptTab;
