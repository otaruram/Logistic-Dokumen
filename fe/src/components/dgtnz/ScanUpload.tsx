import { Upload, X, FileDown, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface ScanUploadProps {
    uploadedImage: File | null;
    previewUrl: string | null;
    isProcessing: boolean;
    onImageSelect: (file: File) => void;
    onClear: () => void;
}

// Compress utility inside component or imported utility
const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = (height * MAX_WIDTH) / width;
                    width = MAX_WIDTH;
                }
                if (height > MAX_HEIGHT) {
                    width = (width * MAX_HEIGHT) / height;
                    height = MAX_HEIGHT;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    } else reject(new Error('Blob failed'));
                }, 'image/jpeg', 0.8);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

export const ScanUpload = ({ uploadedImage, previewUrl, isProcessing, onImageSelect, onClear }: ScanUploadProps) => {

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file);
            onImageSelect(compressed);
        } catch (error) {
            console.error(error);
            toast.error("Failed to process image");
        }
    };

    return (
        <Card className="p-6 border-white/10 bg-[#0a0a0a] text-white">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                    Document Upload
                </h3>
                {previewUrl && (
                    <Button variant="ghost" size="sm" onClick={onClear} disabled={isProcessing} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                        <X className="w-4 h-4 mr-2" />
                        Clear
                    </Button>
                )}
            </div>

            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${previewUrl ? 'border-gray-700 bg-black/50' : 'border-gray-800 hover:border-gray-600 hover:bg-white/5'
                }`}>
                <input
                    type="file"
                    id="imageUpload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                />

                {previewUrl ? (
                    <label htmlFor="imageUpload" className="cursor-pointer block relative group">
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-h-[300px] mx-auto rounded-lg shadow-2xl"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <p className="text-white font-medium">Click to change</p>
                        </div>
                    </label>
                ) : (
                    <label htmlFor="imageUpload" className="cursor-pointer block space-y-4 py-8">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-white">Click or drag image here</p>
                            <p className="text-sm text-gray-500 mt-1">Supports JPG, PNG (Max 10MB)</p>
                        </div>
                    </label>
                )}
            </div>
        </Card>
    );
};
