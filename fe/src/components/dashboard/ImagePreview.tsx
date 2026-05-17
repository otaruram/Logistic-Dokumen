import { X, ZoomIn } from "lucide-react";

interface ImagePreviewProps {
  imageUrl: string | null;
  onClear: () => void;
}

const ImagePreview = ({ imageUrl, onClear }: ImagePreviewProps) => {
  if (!imageUrl) return null;

  return (
    <div className="brutal-border relative">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button className="brutal-border-thin bg-background p-1.5 md:p-2 hover:bg-secondary transition-colors">
          <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
        </button>
        <button
          onClick={onClear}
          className="brutal-border-thin bg-background p-1.5 md:p-2 hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X className="w-3 h-3 md:w-4 md:h-4" />
        </button>
      </div>
      <img
        src={imageUrl}
        alt="Selected manifest"
        className="w-full h-auto max-h-[250px] md:max-h-[300px] object-contain bg-secondary"
      />
      <div className="bg-foreground text-background px-3 py-2">
        <span className="text-[10px] md:text-xs font-bold uppercase">
          GAMBAR DIMUAT - SIAP UNTUK OCR
        </span>
      </div>
    </div>
  );
};

export default ImagePreview;
