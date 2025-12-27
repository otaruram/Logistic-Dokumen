import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const PrivacyPolicy = () => {
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
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold mb-3 tracking-tight">Privacy Policy</h1>
                    <p className="text-gray-400 text-lg">Your data privacy is our top priority. Last updated: Dec 2024</p>
                </div>

                <div className="space-y-12">
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Lock className="w-5 h-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Data Protection</h2>
                        </div>
                        <p className="text-gray-400 leading-relaxed text-lg">
                            We use industry-standard encryption protocols to protect your data both in transit and at rest.
                            Your documents are processed in secure, ephemeral environments and are never used to train global AI models without your explicit consent.
                        </p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Eye className="w-5 h-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Data Usage</h2>
                        </div>
                        <p className="text-gray-400 leading-relaxed text-lg mb-4">
                            We only collect the absolute minimum data required to provide our services:
                        </p>
                        <div className="grid sm:grid-cols-3 gap-4">
                            {['Document Contents', 'Processing Logs', 'User Settings'].map((item) => (
                                <div key={item} className="p-4 bg-[#111] border border-white/10 rounded-xl text-center text-sm text-gray-300">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <FileText className="w-5 h-5 text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Your Rights</h2>
                        </div>
                        <p className="text-gray-400 leading-relaxed text-lg">
                            You retain 100% ownership of your data. You can request a full data export or permanent deletion of your account at any time via the profile settings.
                        </p>
                    </section>

                    <section className="bg-[#111] p-8 rounded-2xl border border-white/10 mt-12 text-center">
                        <h3 className="font-bold text-xl mb-2 text-white">Questions?</h3>
                        <p className="text-gray-400 mb-6">
                            Our Data Protection Officer is available to answer your concerns.
                        </p>
                        <a href="mailto:ocrwtf@gmail.com" className="inline-block px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors">
                            Contact DPO
                        </a>
                    </section>
                </div>
            </motion.div>
        </div>
    );
};

export default PrivacyPolicy;
