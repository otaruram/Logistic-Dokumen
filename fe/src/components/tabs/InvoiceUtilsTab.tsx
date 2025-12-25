import { ArrowLeft, FileText } from 'lucide-react';

interface InvoiceUtilsProps {
  onBack: () => void;
  initialTool?: string;
}

export default function InvoiceUtils({ onBack }: InvoiceUtilsProps) {
  // Since all utility features have been removed, just show a message
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium hover:underline mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to audit.wtf
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-black text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">audit.wtf</h1>
              <p className="text-sm text-gray-600">
                AI-powered invoice fraud detection
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="border-2 border-black p-8 bg-gray-50 text-center">
          <h2 className="text-xl font-bold mb-4">Utilities Feature Removed</h2>
          <p className="text-gray-600 mb-6">
            The invoice utilities have been removed from this version.
            <br />
            Please use the main invoice generation feature instead.
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-bold border-2 border-black hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to audit.wtf
          </button>
        </div>
      </div>
    </div>
  );
}

