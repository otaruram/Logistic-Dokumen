import { AlertCircle, Settings, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const ConfigErrorPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 shadow-xl border-2 border-red-200">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Configuration Missing
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            The application is not properly configured. Environment variables are missing.
          </p>
          
          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 text-left mb-8">
            <div className="flex items-start gap-3 mb-4">
              <Settings className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  For Developers / Admins:
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please add the following environment variables in Vercel Dashboard:
                </p>
                
                <div className="bg-white rounded border border-gray-300 p-4 font-mono text-sm space-y-2">
                  <div>
                    <span className="text-blue-600">VITE_API_URL</span>
                    <span className="text-gray-400"> = </span>
                    <span className="text-green-600">https://api-ocr.xyz</span>
                  </div>
                  <div>
                    <span className="text-blue-600">VITE_SUPABASE_URL</span>
                    <span className="text-gray-400"> = </span>
                    <span className="text-green-600">https://xxxxx.supabase.co</span>
                  </div>
                  <div>
                    <span className="text-blue-600">VITE_SUPABASE_ANON_KEY</span>
                    <span className="text-gray-400"> = </span>
                    <span className="text-green-600">eyJhbGc...</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-3">
                <strong>Steps to fix:</strong>
              </p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Go to Vercel Dashboard → Project Settings</li>
                <li>Navigate to Environment Variables</li>
                <li>Add the 3 variables above</li>
                <li>Select all environments (Production, Preview, Development)</li>
                <li>Click "Save" and trigger a new deployment</li>
              </ol>
            </div>
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button
              asChild
              variant="default"
              className="bg-black hover:bg-gray-800"
            >
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Vercel Dashboard
              </a>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
          
          <p className="text-sm text-gray-500 mt-8">
            Check browser console (F12) for detailed error messages
          </p>
        </div>
      </Card>
    </div>
  );
};
