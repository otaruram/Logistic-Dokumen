import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignatureCanvas from "@/components/ui/signature-canvas";
import { UserCheck, PenTool } from "lucide-react";
import { Card } from "@/components/ui/card";

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

                {/* Signature */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <PenTool className="w-4 h-4" />
                        Digital Signature <span className="text-red-500">*</span>
                    </Label>
                    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white">
                        {/* Signature canvas usually needs a white background to see the ink */}
                        <SignatureCanvas
                            value={signatureData}
                            onChange={setSignatureData}
                            disabled={isProcessing}
                        />
                    </div>
                    <p className="text-xs text-gray-500">Sign above using your mouse or touch screen</p>
                </div>
            </div>
        </Card>
    );
};
