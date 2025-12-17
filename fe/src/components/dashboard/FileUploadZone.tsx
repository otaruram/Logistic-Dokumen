import { useState, useRef } from "react";
import { Upload, Camera, X, Check, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import imageCompression from 'browser-image-compression';
import { toast } from "sonner";

interface FileUploadZoneProps { onFileSelect: (file: File) => void; }

export default function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [mode, setMode] = useState<"upload" | "camera" | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... (Gunakan logika kompresi dan kamera yang sama persis dengan sebelumnya, 
  //      TAPI ubah return JSX-nya menjadi di bawah ini) ...
  
  //  !!! COPY LOGIKA handleCompressAndSend, startCamera, dll DARI KODE SEBELUMNYA !!!
  //  (Supaya tidak terlalu panjang, saya hanya tulis bagian JSX Tampilannya di sini)

  // --- MOCKUP LOGIKA UNTUK DISPLAY (Anda copy full logic dari sebelumnya ya) ---
  const handleCompressAndSend = async (file: File) => { onFileSelect(file); /* Mock */ };
  const handleFileUpload = (e: any) => { if(e.target.files[0]) handleCompressAndSend(e.target.files[0]); };
  
  // TAMPILAN UTAMA
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* BUTTON UPLOAD */}
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-zinc-800/50 transition-all duration-300"
        >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Upload File</h3>
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG (Max 5MB)</p>
        </div>

        {/* BUTTON KAMERA */}
        <div 
            onClick={() => toast.info("Fitur kamera belum di-init di mockup ini, pakai kode full sebelumnya ya!")} 
            className="group cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-zinc-800/50 transition-all duration-300"
        >
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Ambil Foto</h3>
            <p className="text-xs text-gray-400 mt-1">Langsung dari kamera HP</p>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
    </div>
  );
}
