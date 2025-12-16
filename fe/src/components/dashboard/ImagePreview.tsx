import { X, ZoomIn } from "lucide-react";

interface ImagePreviewProps {
  imageUrl: string | null;
  onClear: () => void;
}

const ImagePreview = ({ imageUrl, onClear }: ImagePreviewProps) => {
  if (!imageUrl) return null;

  return (
    <div className="brutal-border relative animate-in zoom-in-95 duration-500 ease-out group">
      <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button className="brutal-border-thin bg-white p-1.5 md:p-2 hover:bg-blue-100 hover:scale-110 transition-all active:scale-95 shadow-sm">
          <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
        </button>
        <button
          onClick={onClear}
          className="brutal-border-thin bg-white p-1.5 md:p-2 hover:bg-red-500 hover:text-white hover:scale-110 transition-all active:scale-95 shadow-sm"
        >
          <X className="w-3 h-3 md:w-4 md:h-4" />
        </button>
      </div>
      
      <div className="overflow-hidden">
        <img
          src={imageUrl}
          alt="Selected manifest"
          className="w-full h-auto max-h-[250px] md:max-h-[300px] object-contain bg-gray-50 transition-transform duration-700 hover:scale-105"
        />
      </div>
      
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider animate-pulse">
          ● SIAP UNTUK OCR
        </span>
        <span className="text-[10px] text-gray-400">Preview Mode</span>
      </div>
    </div>
  );
};

export default ImagePreview;
