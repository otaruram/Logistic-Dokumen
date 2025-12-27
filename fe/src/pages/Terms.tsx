import { ArrowLeft, FileText, Scale, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-8 pl-0 hover:bg-transparent text-gray-400 hover:text-white transition-colors gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Button>

        <div className="mb-12 border-b border-white/10 pb-8">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">Terms of Service</h1>
          <p className="text-gray-400 text-lg">Please read these terms carefully. Last updated: Dec 2024</p>
        </div>

        <div className="space-y-12">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-white">1. Acceptance of Terms</h2>
            </div>
            <p className="text-gray-400 leading-relaxed text-lg">
              By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-white">2. Usage License</h2>
            </div>
            <p className="text-gray-400 leading-relaxed text-lg mb-4">
              Permission is granted to temporarily download one copy of the materials (information or software) on this website for personal, non-commercial transitory viewing only.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-white">3. Disclaimer</h2>
            </div>
            <p className="text-gray-400 leading-relaxed text-lg">
              The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-white">4. Limitations</h2>
            </div>
            <p className="text-gray-400 leading-relaxed text-lg">
              In no event shall we or our suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.
            </p>
          </section>
        </div>

        <div className="mt-16 text-center border-t border-white/10 pt-8">
          <p className="text-gray-500 text-sm">
            Questions about the Terms of Service should be sent to us at <a href="mailto:ocrwtf@gmail.com" className="text-white hover:underline">ocrwtf@gmail.com</a>.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Terms;
