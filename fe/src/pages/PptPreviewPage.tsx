import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PptPreviewPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    const previewUrl = searchParams.get("url");
    const filename = searchParams.get("filename") || "presentation.pdf";
    const downloadUrl = searchParams.get("download") || previewUrl;

    useEffect(() => {
        // Simulate loading
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (!previewUrl) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="p-8 max-w-md text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">No Preview Available</h2>
                    <p className="text-muted-foreground mb-4">
                        No presentation URL provided.
                    </p>
                    <Button onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="h-9 w-9"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                    PPT Preview
                                </h1>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {filename}
                                </p>
                            </div>
                        </div>

                        <Button
                            asChild
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white gap-2"
                        >
                            <a href={downloadUrl} download={filename}>
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Download PDF</span>
                            </a>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Preview Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="overflow-hidden shadow-2xl">
                        {isLoading ? (
                            <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <div className="text-center">
                                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-amber-600" />
                                    <p className="text-sm text-muted-foreground">Loading PDF preview...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900">
                                {/* Native PDF Viewer - Works with PDF files */}
                                <embed
                                    src={previewUrl}
                                    type="application/pdf"
                                    className="w-full aspect-[16/10] border-0"
                                    title="PDF Preview"
                                />

                                {/* Fallback: Direct link if embed doesn't work */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-muted-foreground text-center">
                                        Preview not loading?{" "}
                                        <a
                                            href={previewUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-amber-600 hover:underline font-medium"
                                        >
                                            Open PDF in new tab
                                        </a>
                                    </p>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Info Card */}
                    <Card className="mt-6 p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-500 rounded-lg">
                                <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-sm sm:text-base mb-1">
                                    Premium Presentation (PDF)
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    This presentation was generated with AI using industry-standard design principles.
                                    Download the PDF file to view or share. Available for 7 days.
                                </p>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default PptPreviewPage;
