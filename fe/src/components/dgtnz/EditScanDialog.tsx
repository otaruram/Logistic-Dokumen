import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditScanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: any;
    onSave: (id: number, data: { recipient_name: string; extracted_text: string }) => Promise<void>;
}

export const EditScanDialog = ({ open, onOpenChange, record, onSave }: EditScanDialogProps) => {
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (record) {
            setName(record.namaPenerima || "");
            setContent(record.keterangan || "");
        }
    }, [record]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(record.id, { recipient_name: name, extracted_text: content });
            onOpenChange(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-[#0a0a0a] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Scan Record</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Make changes to the recipient details or content here.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-gray-300">Recipient Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3 bg-[#111] border-white/10 text-white"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="content" className="text-gray-300">Content / Remarks</Label>
                        <Textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="col-span-3 bg-[#111] border-white/10 text-white min-h-[100px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 hover:bg-white/5 text-gray-300">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-white text-black hover:bg-gray-200">
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
