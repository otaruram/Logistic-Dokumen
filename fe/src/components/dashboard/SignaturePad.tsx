import { Eraser, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignatureCanvas from "react-signature-canvas";
import { useRef, useState, useEffect } from "react";

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
}

const SignaturePad = ({ onSignatureChange }: SignaturePadProps) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 128 });
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 4; // Account for border
        setCanvasSize({ width, height: 128 });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
    onSignatureChange(null);
  };

  const handleConfirm = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL("image/png");
      onSignatureChange(dataUrl);
    }
  };

  const handleEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs md:text-sm font-bold uppercase tracking-wide">
        TANDA TANGAN
      </label>
      <div
        ref={containerRef}
        className="brutal-border-thin bg-background overflow-hidden"
      >
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            width: canvasSize.width,
            height: canvasSize.height,
            className: "signature-canvas cursor-crosshair bg-background",
            style: { touchAction: "none" },
          }}
          onEnd={handleEnd}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleClear} className="flex-1">
          <Eraser className="w-4 h-4" />
          HAPUS
        </Button>
        <Button 
          variant={hasSignature ? "primary" : "default"} 
          size="sm" 
          onClick={handleConfirm} 
          className="flex-1"
          disabled={!hasSignature}
        >
          <Check className="w-4 h-4" />
          KONFIRMASI
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
