import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShieldCheck, Upload, AlertTriangle, CheckCircle, FileX, Terminal, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface AuditTabProps {
    onBack: () => void;
}

interface AuditLog {
    stage: string;
    msg: string;
    status?: "success" | "danger" | "warning";
}

interface AuditResult {
    status: string;
    statusColor: string;
    confidenceScore: number;
    findings: string[];
    data: any;
}

const AuditTab = ({ onBack }: AuditTabProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [result, setResult] = useState<AuditResult | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(selectedFile);
            // Reset state
            setResult(null);
            setLogs([]);
        }
    };

    const simulateLogs = async (serverLogs: AuditLog[]) => {
        // Play logs with delay for animation effect
        for (const log of serverLogs) {
            await new Promise(r => setTimeout(r, 600)); // Delay between logs
            setLogs(prev => [...prev, log]);
        }
    };

    const startAudit = async () => {
        if (!file) return;

        setIsAuditing(true);
        setLogs([{ stage: "INIT", msg: "Establishing secure connection..." }]);
        setResult(null);

        try {
            const { supabase } = await import("@/lib/supabaseClient");
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                toast.error("Access Denied: Login required");
                setIsAuditing(false);
                return;
            }

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${API_BASE_URL}/api/audit/analyze`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Audit failed");
            }

            // Animate logs from server
            if (data.logs) {
                await simulateLogs(data.logs);
            }

            setResult({
                status: data.status,
                statusColor: data.statusColor,
                confidenceScore: data.confidenceScore,
                findings: data.findings,
                data: data.data
            });

        } catch (error: any) {
            setLogs(prev => [...prev, { stage: "ERR", msg: `CRITICAL ERROR: ${error.message}`, status: "danger" }]);
            toast.error("Audit Terminated");
        } finally {
            setIsAuditing(false);
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
                        <h2 className="text-xl sm:text-2xl font-semibold">audit.wtf</h2>
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-black text-green-500 border border-green-500 rounded">
                            GOD MODE
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Forensic Document Auditing System
                    </p>
                </div>
            </div>

            {/* Upload UI */}
            <Card className="p-4 sm:p-6 border-dashed border-2 hover:border-green-500/50 transition-colors">
                {!preview ? (
                    <label className="flex flex-col items-center justify-center h-48 cursor-pointer gap-3">
                        <div className="p-4 bg-muted rounded-full">
                            <Upload className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium">Upload Document for Audit</p>
                            <p className="text-xs text-muted-foreground">PDF, JPG, PNG (Max 10MB)</p>
                        </div>
                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf" />
                    </label>
                ) : (
                    <div className="space-y-4">
                        <div className="relative h-64 bg-black/5 rounded-lg overflow-hidden flex items-center justify-center">
                            <img src={preview} alt="Evidence" className="max-h-full object-contain" />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 rounded-full"
                                onClick={() => { setFile(null); setPreview(null); setLogs([]); setResult(null); }}
                            >
                                <FileX className="w-4 h-4" />
                            </Button>
                        </div>

                        {!isAuditing && !result && (
                            <Button
                                size="lg"
                                className="w-full font-mono font-bold bg-black hover:bg-zinc-900 text-green-500 border border-green-900 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                onClick={startAudit}
                            >
                                <ScanLine className="w-4 h-4 mr-2" />
                                INITIATE_AUDIT_PROTOCOL
                            </Button>
                        )}
                    </div>
                )}
            </Card>

            {/* Matrix Logs */}
            {(isAuditing || logs.length > 0) && (
                <Card className="bg-black border-green-900/50 p-4 font-mono text-xs sm:text-sm shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 animate-pulse" />

                    <div className="flex items-center gap-2 mb-3 text-green-500/70 border-b border-green-900/50 pb-2">
                        <Terminal className="w-4 h-4" />
                        <span>SYSTEM_LOGS</span>
                        {isAuditing && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                    </div>

                    <div className="space-y-1.5 h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {logs.map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex gap-2 ${log.status === 'danger' ? 'text-red-500' :
                                        log.status === 'success' ? 'text-green-400' :
                                            log.status === 'warning' ? 'text-yellow-400' :
                                                'text-green-500/80'
                                    }`}
                            >
                                <span className="opacity-50">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                <span>{`>`}</span>
                                <span>{log.msg}</span>
                            </motion.div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </Card>
            )}

            {/* Results */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className={`p-6 border-l-4 ${result.statusColor === 'green' ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' :
                                result.statusColor === 'red' ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' :
                                    'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20'
                            }`}>
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight mb-1">
                                        VERDICT: {result.status.replace('_', ' ')}
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>Confidence Score:</span>
                                        <span className="font-bold text-foreground">{result.confidenceScore}%</span>
                                    </div>
                                </div>
                                {result.statusColor === 'green' ? (
                                    <ShieldCheck className="w-12 h-12 text-green-500" />
                                ) : (
                                    <AlertTriangle className={`w-12 h-12 ${result.statusColor === 'red' ? 'text-red-500' : 'text-yellow-500'}`} />
                                )}
                            </div>

                            {result.findings.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm border-b pb-2">Analysis Findings</h4>
                                    <ul className="space-y-2">
                                        {result.findings.map((finding: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                                <span>{finding}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {result.findings.length === 0 && result.statusColor === 'green' && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 p-4 bg-green-100/50 dark:bg-green-900/30 rounded-lg">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-medium">Document verified authentic. No anomalies detected.</span>
                                </div>
                            )}
                        </Card>

                        {/* Data Table */}
                        {result.data && (
                            <Card className="mt-4 p-4">
                                <h4 className="font-medium text-sm mb-3">Extracted Data</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Invoice No</p>
                                        <p className="font-mono">{result.data.invoiceNumber || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Date</p>
                                        <p className="font-mono">{result.data.invoiceDate || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Vendor</p>
                                        <p className="font-medium">{result.data.vendorName || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Total</p>
                                        <p className="font-mono font-bold">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(result.data.grandTotal || 0)}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AuditTab;
