import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignatureCanvas from "@/components/ui/signature-canvas";
import { UserCheck, PenTool } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface ValidationZoneProps {
    recipientName: string;
    setRecipientName: (value: string) => void;
    signatureData: string;
    setSignatureData: (value: string) => void;
    isProcessing: boolean;
}

export const ValidationZone = ({
    recipientName,
    setRecipientName,
    signatureData,
    setSignatureData,
    isProcessing
}: ValidationZoneProps) => {
    const [hasMeterai, setHasMeterai] = useState(false);

    return (
        <Card className="p-6 border-white/10 bg-[#0a0a0a] text-white">
            <div className="mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-gray-400" />
                    Validation Zone
                </h3>
                <p className="text-sm text-gray-500 mt-1">Required details for document verification</p>
            </div>

            <div className="space-y-6">
                {/* Recipient Name */}
                <div className="space-y-2">
                    <Label htmlFor="recipient" className="text-sm font-medium text-gray-300">
                        Recipient Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="recipient"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Enter recipient's full name"
                        className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-white/30 h-11"
                        disabled={isProcessing}
                    />
                </div>

                {/* Materai Toggle */}
                <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-lg border border-white/10">
                    <input
                        type="checkbox"
                        id="meterai-toggle"
                        checked={hasMeterai}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        onChange={(e) => {
                            setHasMeterai(e.target.checked);
                            if (e.target.checked) {
                                toast.info("Mode Materai Aktif: Tanda tangan harus mengenai/menimpa materai.", { icon: "📝" });
                            }
                        }}
                    />
                    <label htmlFor="meterai-toggle" className="text-xs font-medium text-gray-400 cursor-pointer">
                        Transaksi Rp 1.000.000 ke atas (Wajib Materai 10000)
                    </label>
                </div>

                {/* Signature */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <PenTool className="w-4 h-4" />
                        Digital Signature <span className="text-red-500">*</span>
                    </Label>
                    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white">
                        <SignatureCanvas
                            value={signatureData}
                            onChange={setSignatureData}
                            disabled={isProcessing}
                            backgroundImage={hasMeterai ? "/meterai_10000.png" : undefined}
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        {hasMeterai 
                            ? "Tanda tangan harus menimpa materai di atas" 
                            : "Tanda tangan di area di atas"}
                    </p>
                </div>
            </div>
        </Card>
    );
};
