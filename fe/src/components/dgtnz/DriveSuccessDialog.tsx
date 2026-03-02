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

interface DriveSuccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileUrl: string;
}

export const DriveSuccessDialog = ({ open, onOpenChange, fileUrl }: DriveSuccessDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 text-white">
                <DialogHeader className="flex flex-col items-center text-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-blue-500" />
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-xl font-bold">Export Successful!</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Your document has been exported to Google Drive.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full mt-6">
                    <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full flex-1 border-white/10 hover:bg-white/5 text-gray-300">
                        Close
                    </Button>
                    <Button onClick={() => window.open(fileUrl, "_blank")} className="w-full flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <ExternalLink className="w-4 h-4" /> Open in Drive
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
