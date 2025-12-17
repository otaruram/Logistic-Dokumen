import { useState, useRef } from "react";
import { Upload, Camera, X, Check, Zap, ZapOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import imageCompression from 'browser-image-compression';
import { toast } from "sonner";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [mode, setMode] = useState<"upload" | "camera" | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIKA KOMPRESI & UPLOAD ---
  const handleCompressAndSend = async (file: File) => {
    setIsCompressing(true);
    try {
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
      toast.warning("Gagal kompres gambar, mengirim file asli.");
      onFileSelect(file);
    } finally {
      setIsCompressing(false);
      setMode(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCompressAndSend(e.target.files[0]);
    }
  };

  // --- LOGIKA KAMERA ---
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
      if (!mediaStream || mediaStream.getVideoTracks().length === 0) throw new Error("Kamera tidak ditemukan");

      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any; // Cast any utk akses torch
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
      toast.error("Gagal akses kamera", { description: error.message });
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
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
          stopCamera();
          handleCompressAndSend(file);
        });
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setTimeout(() => startCamera(), 100);
  };

  // --- TAMPILAN LOADING (Clean) ---
  if (isCompressing) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 animate-in fade-in">
         <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
         <h3 className="font-semibold text-gray-900 dark:text-white">Mengoptimalkan Gambar...</h3>
         <p className="text-xs text-gray-500">Mohon tunggu sebentar</p>
      </div>
    );
  }

  // --- TAMPILAN KAMERA (Clean) ---
  if (mode === "camera") {
    return (
      <div className="bg-black rounded-3xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header Kamera */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white font-medium text-sm">Mode Kamera</span>
          <Button onClick={stopCamera} size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!capturedImage ? (
          <div className="relative h-[500px] w-full bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            
            {/* Controls Bawah */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-around items-center bg-gradient-to-t from-black/80 to-transparent">
               {torchSupported && (
                <Button onClick={toggleFlash} size="icon" variant="ghost" className={`rounded-full ${flashEnabled ? "bg-yellow-400 text-black" : "text-white bg-white/10"}`}>
                  {flashEnabled ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                </Button>
               )}
               
               <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 shadow-lg active:scale-90 transition-transform"></button>
               
               <div className="w-10"></div> {/* Spacer biar seimbang */}
            </div>
          </div>
        ) : (
          <div className="relative h-[500px] w-full bg-black">
            <img src={capturedImage} alt="Preview" className="w-full h-full object-contain" />
            
            {/* Controls Preview */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex gap-4 bg-black/80 backdrop-blur-sm">
              <Button onClick={retakePhoto} variant="outline" className="flex-1 bg-transparent border-white text-white hover:bg-white hover:text-black rounded-xl">
                <RefreshCw className="w-4 h-4 mr-2" /> Ulangi
              </Button>
              <Button onClick={confirmPhoto} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl border-none">
                <Check className="w-4 h-4 mr-2" /> Gunakan Foto
              </Button>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // --- TAMPILAN DEFAULT (PILIHAN) ---
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* KARTU 1: UPLOAD FILE */}
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-3xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all duration-300"
        >
            <div className="w-14 h-14 bg-blue-50 dark:bg-zinc-800 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Upload Dokumen</h3>
            <p className="text-xs text-gray-400 mt-1">JPEG/PNG, Maks. 5MB</p>
        </div>

        {/* KARTU 2: AMBIL FOTO */}
        <div 
            onClick={startCamera} 
            className="group cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-3xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all duration-300"
        >
            <div className="w-14 h-14 bg-purple-50 dark:bg-zinc-800 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <Camera className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Ambil Foto</h3>
            <p className="text-xs text-gray-400 mt-1">Gunakan Kamera HP</p>
        </div>

      </div>
      
      {/* Hidden Input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
    </div>
  );
}
