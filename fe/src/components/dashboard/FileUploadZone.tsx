import { useState, useRef } from "react";
import { Upload, Camera, X, Check, Zap, ZapOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import imageCompression from 'browser-image-compression'; // 🔥 IMPORT LIBRARY BARU
import { toast } from "@/hooks/use-toast";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [mode, setMode] = useState<"upload" | "camera" | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  
  // 🔥 STATE UNTUK LOADING KOMPRESI
  const [isCompressing, setIsCompressing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 🔥 FUNGSI KOMPRESI OTOMATIS ---
  const handleCompressAndSend = async (file: File) => {
    setIsCompressing(true);
    try {
      // Opsi Kompresi: Max 0.8MB, Lebar Max 1200px (Cukup bgt buat OCR)
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        initialQuality: 0.7,
      };

      console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      
      const compressedFile = await imageCompression(file, options);
      
      console.log(`Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
      
      onFileSelect(compressedFile);
    } catch (error) {
      console.error("Gagal kompres, kirim original:", error);
      toast({ title: "Warning", description: "Gagal kompres gambar, mengirim file asli." });
      onFileSelect(file);
    } finally {
      setIsCompressing(false);
      setMode(null);
    }
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mediaStream || mediaStream.getVideoTracks().length === 0) throw new Error("No video track");

      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      setTorchSupported(!!capabilities.torch);

      setStream(mediaStream);
      setMode("camera");

      setTimeout(() => {
        if (videoRef.current && mediaStream) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);

    } catch (error: any) {
      alert(`Gagal mengakses kamera: ${error.message}`);
      setMode(null);
    }
  };

  const toggleFlash = async () => {
    if (!stream || !torchSupported) return;
    try {
      const track = stream.getVideoTracks()[0];
      const newFlashState = !flashEnabled;
      await track.applyConstraints({ advanced: [{ torch: newFlashState } as any] });
      setFlashEnabled(newFlashState);
    } catch (e) { console.error(e); }
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setMode(null);
    setCapturedImage(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(imageDataUrl);
      }
    }
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      // Ubah Base64 jadi File
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
          stopCamera(); // Stop kamera dulu biar hemat RAM
          handleCompressAndSend(file); // 🔥 KOMPRES HASIL KAMERA
        });
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setTimeout(() => startCamera(), 100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // 🔥 KOMPRES HASIL UPLOAD
      handleCompressAndSend(e.target.files[0]);
    }
  };

  // --- TAMPILAN SAAT SEDANG MENGOMPRES (LOADING) ---
  if (isCompressing) {
    return (
      <div className="brutal-border bg-white p-8 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
         <Loader2 className="w-12 h-12 animate-spin text-black" />
         <div className="text-center">
             <h3 className="font-black text-lg uppercase">MENGOMPRES...</h3>
             <p className="text-xs font-mono text-gray-500">Mengecilkan ukuran agar upload ngebut 🚀</p>
         </div>
      </div>
    );
  }

  if (mode === "camera") {
    return (
      <div className="brutal-border bg-background p-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm uppercase">AMBIL FOTO</h3>
          <Button onClick={stopCamera} variant="outline" size="sm" className="brutal-btn hover:bg-red-100 hover:text-red-600 transition-colors">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {!capturedImage ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="relative bg-black brutal-border overflow-hidden group">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" style={{ minHeight: "300px", maxHeight: "500px", objectFit: "cover", display: "block" }} />
              {torchSupported && (
                <Button onClick={toggleFlash} variant="outline" size="sm" className={`absolute top-2 right-2 brutal-btn transition-all duration-300 ${flashEnabled ? "bg-yellow-400 text-black scale-110" : "bg-white/80"}`}>
                  {flashEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </Button>
              )}
            </div>
            <Button onClick={capturePhoto} className="w-full brutal-btn h-12 text-lg active:scale-95 transition-transform duration-100">
              <Camera className="w-5 h-5 mr-2" /> AMBIL GAMBAR
            </Button>
          </div>
        ) : (
          <div className="space-y-4 animate-in zoom-in-95 duration-300">
            <img src={capturedImage} alt="Preview" className="w-full brutal-border shadow-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={retakePhoto} variant="outline" className="brutal-btn hover:bg-red-50 hover:border-red-500 hover:text-red-600">
                <X className="w-4 h-4 mr-2" /> ULANGI
              </Button>
              <Button onClick={confirmPhoto} className="brutal-btn bg-green-500 hover:bg-green-400 text-white border-black">
                <Check className="w-4 h-4 mr-2" /> GUNAKAN
              </Button>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="brutal-border bg-background p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="font-bold text-sm uppercase mb-4 text-center tracking-widest">
        PILIH METODE INPUT
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { setMode("upload"); fileInputRef.current?.click(); }} className="brutal-border bg-background p-6 transition-all duration-300 flex flex-col items-center gap-3 group hover:bg-blue-50 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none">
          <div className="p-3 bg-blue-100 rounded-full border-2 border-black group-hover:bg-blue-200 transition-colors">
             <Upload className="w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="font-black text-xs uppercase tracking-tight">UPLOAD FILE</span>
        </button>
        <button onClick={startCamera} className="brutal-border bg-background p-6 transition-all duration-300 flex flex-col items-center gap-3 group hover:bg-yellow-50 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none">
          <div className="p-3 bg-yellow-100 rounded-full border-2 border-black group-hover:bg-yellow-200 transition-colors">
             <Camera className="w-8 h-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <span className="font-black text-xs uppercase tracking-tight">AMBIL FOTO</span>
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
    </div>
  );
}
