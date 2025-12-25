import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Download, FileText, Loader2, Maximize2,
    ChevronLeft, ChevronRight, Image as ImageIcon, FileType, Presentation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
).toString();

const PptPreviewPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);

    // Fullscreen & Resizing
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                // Calculate optimal dimensions preserving pseudo-aspect ratio or just fit container
                // Subtracting padding to avoid scrollbars if possible
                setPageDimensions({
                    width: width - 40, // padding
                    height: height - 40
                });
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Fullscreen State
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || "Presentation.pdf";
    const downloadUrl = searchParams.get("download") || url || "";
    const pptxUrl = searchParams.get("pptx") || "";

    const previewUrl = url
        ? (url.startsWith("http") ? url : `${import.meta.env.VITE_API_URL}${url}`)
        : "";

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => prevPageNumber + offset);
    };

    const previousPage = () => changePage(-1);
    const nextPage = () => changePage(1);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                toast.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const handleComingSoon = (feature: string) => {
        toast.info(`${feature} download coming soon!`);
    };

    if (!previewUrl) {
        return (
            <div className="flex bg-neutral-950 min-h-screen items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <p className="text-white text-lg">Invalid preview URL</p>
                    <Button onClick={() => navigate(-1)} variant="secondary">Go Back</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
            {/* Minimalist Header */}
            <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="h-9 w-9 text-neutral-400 hover:text-white hover:bg-neutral-800"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-sm font-medium tracking-tight text-neutral-200">
                                    {filename}
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleFullscreen}
                                className="h-9 w-9 text-neutral-400 hover:text-white hover:bg-neutral-800"
                                title="Fullscreen"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-white text-black hover:bg-neutral-200 transition-colors h-9 px-4 text-xs font-medium">
                                        <Download className="h-3.5 w-3.5 mr-2" />
                                        Download
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-neutral-900 border-neutral-800 text-neutral-200">
                                    <DropdownMenuItem onClick={() => window.open(downloadUrl, '_blank')} className="focus:bg-neutral-800 cursor-pointer">
                                        <FileText className="h-4 w-4 mr-2" />
                                        <span>PDF Document</span>
                                    </DropdownMenuItem>
                                    {pptxUrl && (
                                        <DropdownMenuItem onClick={() => window.open(pptxUrl, '_blank')} className="focus:bg-neutral-800 cursor-pointer">
                                            <Presentation className="h-4 w-4 mr-2" />
                                            <span>PowerPoint (.pptx)</span>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-neutral-950" ref={containerRef}>
                <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pageNumber}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="relative shadow-2xl shadow-black/50"
                        >
                            <Document
                                file={previewUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex items-center justify-center h-[500px] w-full bg-neutral-900 rounded-lg">
                                        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
                                    </div>
                                }
                                error={
                                    <div className="flex items-center justify-center h-[500px] w-full bg-neutral-900 rounded-lg text-red-400">
                                        Failed to load PDF
                                    </div>
                                }
                                className="border border-neutral-800 shadow-2xl"
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    height={isFullscreen ? (pageDimensions.height || window.innerHeight) : (window.innerWidth < 768 ? 300 : 500)}
                                    className="max-h-full max-w-full"
                                    loading={
                                        <div className="h-[500px] w-full flex items-center justify-center bg-neutral-900">
                                            <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
                                        </div>
                                    }
                                />
                            </Document>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation Overlay */}
                {numPages && (
                    <>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={previousPage}
                                disabled={pageNumber <= 1}
                                className="h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur disabled:opacity-0 transition-all"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={nextPage}
                                disabled={pageNumber >= numPages}
                                className="h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur disabled:opacity-0 transition-all"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </div>

                        {/* Page Indicator */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                            <div className="px-4 py-1.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-medium">
                                Page {pageNumber} of {numPages}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PptPreviewPage;
