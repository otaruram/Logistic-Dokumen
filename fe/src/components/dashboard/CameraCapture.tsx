import { useRef, useState, useCallback } from "react";
import { Camera, X, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string>("");

  const startCamera = useCallback(async (mode: "user" | "environment") => {
    try {
      setError("");
      
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        setFacingMode(mode);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera_${Date.now()}.jpg`, {
            type: "image/jpeg"
          });
          onCapture(file);
          stopCamera();
          onClose();
        }
      }, "image/jpeg", 0.95);
    }
  }, [onCapture, onClose, stopCamera]);

  const handleSwitchCamera = useCallback(() => {
    const newMode = facingMode === "user" ? "environment" : "user";
    startCamera(newMode);
  }, [facingMode, startCamera]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // Auto start camera on mount
  useState(() => {
    startCamera(facingMode);
    return () => stopCamera();
  });

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="brutal-border-thin border-t-0 border-l-0 border-r-0 bg-background p-3 flex items-center justify-between">
        <h2 className="text-sm md:text-base font-bold uppercase">AMBIL FOTO</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="brutal-button px-2 py-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {error ? (
          <div className="text-center p-4">
            <p className="text-destructive text-sm mb-4">{error}</p>
            <Button
              onClick={() => startCamera(facingMode)}
              className="brutal-button"
            >
              COBA LAGI
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full"
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>

      {/* Controls */}
      {isCameraActive && (
        <div className="brutal-border-thin border-b-0 border-l-0 border-r-0 bg-background p-4 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={handleSwitchCamera}
            className="brutal-button px-4 py-2"
          >
            <SwitchCamera className="w-5 h-5" />
          </Button>
          
          <Button
            variant="primary"
            onClick={handleCapture}
            className="brutal-button px-8 py-3 text-base"
          >
            <Camera className="w-5 h-5 mr-2" />
            AMBIL FOTO
          </Button>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
