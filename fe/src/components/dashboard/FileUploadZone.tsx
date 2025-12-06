import { useState, useRef } from "react";
import { Upload, Camera, X, Check, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [mode, setMode] = useState<"upload" | "camera" | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      // Request camera with better constraints
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!mediaStream || mediaStream.getVideoTracks().length === 0) {
        throw new Error("No video track available");
      }

      // Check if torch/flash is supported
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      setTorchSupported(!!capabilities.torch);
      
      // Set stream first
      setStream(mediaStream);
      setMode("camera");
      
      // Wait for next frame before setting video source
      setTimeout(() => {
        if (videoRef.current && mediaStream) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
          });
        }
      }, 100);
      
    } catch (error: any) {
      console.error("Camera error:", error);
      alert(`Gagal mengakses kamera: ${error.message || "Unknown error"}`);
      setMode(null);
    }
  };

  const toggleFlash = async () => {
    if (!stream || !torchSupported) return;
    
    try {
      const track = stream.getVideoTracks()[0];
      const newFlashState = !flashEnabled;
      
      await track.applyConstraints({
        advanced: [{ torch: newFlashState } as any]
      });
      
      setFlashEnabled(newFlashState);
    } catch (error) {
      console.error("Failed to toggle flash:", error);
      alert("Gagal mengaktifkan flash");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
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
      // Convert base64 to File
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `camera_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onFileSelect(file);
          stopCamera();
        });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
      setMode(null);
    }
  };

  if (mode === "camera") {
    return (
      <div className="brutal-border bg-background p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm uppercase">AMBIL FOTO</h3>
          <Button
            onClick={stopCamera}
            variant="outline"
            size="sm"
            className="brutal-btn"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {!capturedImage ? (
          <>
            <div className="relative bg-black brutal-border">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
                style={{ 
                  minHeight: "400px",
                  maxHeight: "600px",
                  objectFit: "cover",
                  display: "block"
                }}
              />
              {torchSupported && (
                <Button
                  onClick={toggleFlash}
                  variant="outline"
                  size="sm"
                  className={`absolute top-2 right-2 brutal-btn ${
                    flashEnabled ? "bg-yellow-400 text-black" : ""
                  }`}
                >
                  {flashEnabled ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <ZapOff className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            <Button
              onClick={capturePhoto}
              className="w-full brutal-btn brutal-press"
            >
              <Camera className="w-4 h-4 mr-2" />
              AMBIL GAMBAR
            </Button>
          </>
        ) : (
          <>
            <img
              src={capturedImage}
              alt="Preview"
              className="w-full brutal-border"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setCapturedImage(null)}
                variant="outline"
                className="brutal-btn"
              >
                <X className="w-4 h-4 mr-2" />
                ULANGI
              </Button>
              <Button
                onClick={confirmPhoto}
                className="brutal-btn brutal-press"
              >
                <Check className="w-4 h-4 mr-2" />
                GUNAKAN
              </Button>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="brutal-border bg-background p-6">
      <h3 className="font-bold text-sm uppercase mb-4 text-center">
        PILIH METODE INPUT
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Upload File Button */}
        <button
          onClick={() => {
            setMode("upload");
            fileInputRef.current?.click();
          }}
          className="brutal-border bg-background p-6 hover:bg-accent transition-colors brutal-press flex flex-col items-center gap-3 group"
        >
          <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-xs uppercase">UPLOAD FILE</span>
        </button>

        {/* Camera Button */}
        <button
          onClick={startCamera}
          className="brutal-border bg-background p-6 hover:bg-accent transition-colors brutal-press flex flex-col items-center gap-3 group"
        >
          <Camera className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-xs uppercase">AMBIL FOTO</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
