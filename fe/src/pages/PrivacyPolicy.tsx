import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const PrivacyPolicy = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white p-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-6 pl-0 hover:bg-transparent hover:text-gray-600"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back
                </Button>

                <div className="mb-8">
                    <Shield className="w-12 h-12 text-black mb-4" />
                    <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
                    <p className="text-gray-500">Last updated: December 25, 2024</p>
                </div>

                <div className="space-y-8">
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Lock className="w-5 h-5 text-gray-700" />
                            <h2 className="text-xl font-semibold">Data Protection</h2>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                            We take the security of your data seriously. All uploaded documents and generated content are processed securely and are not shared with third parties without your explicit consent. Files are automatically encrypted at rest.
                        </p>
                    </section>

                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Eye className="w-5 h-5 text-gray-700" />
                            <h2 className="text-xl font-semibold">Data Usage</h2>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                            We collect minimal data necessary to provide our services, such as:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
                            <li>Document contents (for OCR processing)</li>
                            <li>Generated quiz history</li>
                            <li>User preferences and settings</li>
                        </ul>
                    </section>

                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-5 h-5 text-gray-700" />
                            <h2 className="text-xl font-semibold">Your Rights</h2>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                            You retain full ownership of your data. You may request the deletion of your account and all associated data at any time through the settings menu or by contacting support.
                        </p>
                    </section>

                    <section className="bg-gray-50 p-6 rounded-xl border border-gray-100 mt-8">
                        <h3 className="font-semibold mb-2">Contact Us</h3>
                        <p className="text-gray-600 text-sm">
                            If you have any questions about this Privacy Policy, please contact us at: <br />
                            <span className="text-black font-medium">ocrwtf@gmail.com</span>
                        </p>
                    </section>
                </div>
            </motion.div>
        </div>
    );
};

export default PrivacyPolicy;
