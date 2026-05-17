import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, ExternalLink } from "lucide-react";

interface ScanSuccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageUrl: string;
}

export const ScanSuccessDialog = ({ open, onOpenChange, imageUrl }: ScanSuccessDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 text-white">
                <DialogHeader className="flex flex-col items-center text-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-2xl font-bold">Scan Successful!</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Document has been successfully digitized and saved to secure storage.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full mt-6">
                    <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full flex-1 border-white/10 hover:bg-white/5 text-gray-300">
                        Tutup
                    </Button>
                    <Button onClick={() => window.open(imageUrl, "_blank")} className="w-full flex-1 bg-white text-black hover:bg-gray-200 gap-2">
                        <ExternalLink className="w-4 h-4" /> Buka
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
