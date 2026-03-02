import { ArrowLeft, HelpCircle, Book, MessageCircle, Mail, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Help = () => {
    const navigate = useNavigate();

    const faqs = [
        {
            question: "How does the OCR process work?",
            answer: "Our Advanced OCR engine combines Tesseract 5 with GPT-4o to analyze your uploaded documents. It corrects typos, formats unstructured text into JSON, and extracts key entities with >99% accuracy."
        },
        {
            question: "What file formats are supported?",
            answer: "We currently support JPG, PNG, and PDF files. For best results, ensure your documents are well-lit and the text is legible. The maximum file size is 10MB."
        },
        {
            question: "Is my data private?",
            answer: "Absolutely. We use ephemeral processing containers. Your files are processed in memory and are encrypted when stored. See our Privacy Policy for more details."
        },
        {
            question: "How do I delete my account?",
            answer: "Go to the Profile tab and scroll to the bottom. Click 'Delete Account Permanently'. Warning: This action is irreversible and will wipe all your scan history."
        }
    ];

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

                <div className="mb-12 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <HelpCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold mb-3 tracking-tight">Help Center</h1>
                    <p className="text-gray-400 text-lg">Guides, answers, and support.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                    <button
                        onClick={() => window.open("https://github.com/otaruram/Logistic-Dokumen-main", "_blank")}
                        className="p-6 border border-white/10 rounded-2xl bg-[#111] hover:bg-white/5 transition-all text-left group"
                    >
                        <div className="p-3 bg-white/5 rounded-xl w-fit mb-4 group-hover:bg-white/10 transition-colors">
                            <Book className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-bold text-lg mb-1">Documentation</h3>
                        <p className="text-sm text-gray-400">Read detailed integration guides</p>
                    </button>
                    <button
                        onClick={() => window.open("https://wa.link/p3ttrj", "_blank")}
                        className="p-6 border border-white/10 rounded-2xl bg-[#111] hover:bg-white/5 transition-all text-left group"
                    >
                        <div className="p-3 bg-white/5 rounded-xl w-fit mb-4 group-hover:bg-white/10 transition-colors">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-bold text-lg mb-1">Live Chat</h3>
                        <p className="text-sm text-gray-400">Chat with our support team</p>
                    </button>
                </div>

                <div className="space-y-8">
                    <h2 className="text-2xl font-bold px-2">Frequently Asked Questions</h2>

                    <div className="space-y-4">
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            {faqs.map((faq, index) => (
                                <AccordionItem key={index} value={`item-${index}`} className="border border-white/10 rounded-xl bg-[#111] px-6">
                                    <AccordionTrigger className="text-left font-medium text-lg py-6 hover:no-underline hover:text-gray-300 [&[data-state=open]]:text-white">
                                        {faq.question}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-gray-400 text-base pb-6 leading-relaxed">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>

                <div className="mt-16 text-center p-8 bg-gradient-to-br from-white to-gray-200 text-black rounded-3xl">
                    <Mail className="w-10 h-10 mx-auto mb-4" />
                    <h3 className="font-bold text-2xl mb-2">Still need help?</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Our support team is available 24/7 to assist you with any technical issues.
                    </p>
                    <Button
                        size="lg"
                        className="bg-black text-white hover:bg-gray-800 rounded-full px-8 h-12"
                        onClick={() => window.location.href = "mailto:ocrwtf@gmail.com"}
                    >
                        Contact Support
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default Help;
