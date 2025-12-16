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
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 4;
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
    <div className="space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100">
      <div className="flex justify-between items-center">
        <label className="block text-xs md:text-sm font-black uppercase tracking-wide">
          TANDA TANGAN
        </label>
        {hasSignature && (
            <span className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded animate-in fade-in zoom-in">
                TERISI ✓
            </span>
        )}
      </div>
      
      <div
        ref={containerRef}
        className={`brutal-border-thin bg-white dark:bg-gray-800 overflow-hidden transition-all duration-300 ${
            hasSignature ? "shadow-[4px_4px_0px_0px_#22c55e] border-green-600" : "hover:shadow-md"
        }`}
      >
        <SignatureCanvas
          ref={sigCanvas}
          penColor={isDarkMode ? "white" : "black"}
          canvasProps={{
            width: canvasSize.width,
            height: canvasSize.height,
            className: "signature-canvas cursor-crosshair bg-white dark:bg-gray-800 active:cursor-grabbing",
            style: { touchAction: "none" },
          }}
          onEnd={handleEnd}
        />
      </div>
      
      <div className="flex gap-2">
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClear} 
            className="flex-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors active:scale-95"
        >
          <Eraser className="w-4 h-4 mr-2" />
          HAPUS
        </Button>
        <Button 
          variant={hasSignature ? "default" : "secondary"} 
          size="sm" 
          onClick={handleConfirm} 
          className={`flex-1 transition-all duration-300 ${
            hasSignature 
                ? "bg-black text-white hover:bg-gray-800 hover:scale-[1.02] shadow-md" 
                : "opacity-50 cursor-not-allowed"
          }`}
          disabled={!hasSignature}
        >
          <Check className="w-4 h-4 mr-2" />
          KONFIRMASI
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
