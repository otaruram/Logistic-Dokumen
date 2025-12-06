import { useState, useRef } from "react";
import { Upload, Camera, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [mode, setMode] = useState<"upload" | "camera" | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 16/9 },
        },
      });
      
      // Try to enable torch/flash if available
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: true } as any]
          });
        } catch (e) {
          console.log("Torch not supported on this device");
        }
      }
      
      setStream(mediaStream);
      setMode("camera");
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Add brightness and contrast via CSS
        videoRef.current.style.filter = "brightness(1.3) contrast(1.1)";
      }
    } catch (error) {
      alert("Gagal mengakses kamera");
      console.error(error);
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full brutal-border bg-black"
            />
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
