import { Upload, FileImage, X } from "lucide-react";
import { useCallback, useState } from "react";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

const FileDropZone = ({ onFileSelect, selectedFile, onClear }: FileDropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    <div className="space-y-4">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`dashed-drop-zone flex flex-col items-center justify-center p-6 md:p-8 cursor-pointer transition-colors min-h-[160px] md:min-h-[200px] ${
          isDragging ? "bg-secondary" : "bg-background hover:bg-secondary/50"
        }`}
      >
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileInput}
          className="hidden"
        />
        <Upload className="w-10 h-10 md:w-12 md:h-12 mb-3 md:mb-4" strokeWidth={2} />
        <span className="font-bold uppercase text-xs md:text-sm tracking-wide text-center">
          LETAKKAN MANIFEST DISINI
        </span>
        <span className="text-[10px] md:text-xs text-muted-foreground mt-2 uppercase">
          ATAU KLIK UNTUK BROWSE
        </span>
      </label>

      {selectedFile && (
        <div className="brutal-border-thin p-3 md:p-4 bg-secondary">
          <div className="flex items-center gap-3">
            <FileImage className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs md:text-sm uppercase truncate">
                {selectedFile.name}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                onClear();
              }}
              className="brutal-border-thin bg-background p-1.5 md:p-2 hover:bg-destructive hover:text-destructive-foreground transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
