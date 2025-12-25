import { ArrowLeft, HelpCircle, Book, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Help = () => {
    const navigate = useNavigate();

    const faqs = [
        {
            question: "How does the OCR process work?",
            answer: "Our Advanced OCR engine analyzes your uploaded documents or images to identify and extract text with high accuracy. It supports various formats including PDF, JPG, and PNG."
        },
        {
            question: "Can I export my quizzes?",
            answer: "Yes! Currently, you can generate quizzes from your documents and we are working on export features to let you download them as PDF or interact with them online."
        },
        {
            question: "Is my data private?",
            answer: "Absolutely. We prioritize your privacy. Your documents are processed securely and are only accessible to you. See our Privacy Policy for more details."
        },
        {
            question: "How do I reset my account?",
            answer: "You can manage your account settings, including password resets and data deletion, directly from the Profile tab in the application."
        }
    ];

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
                    <HelpCircle className="w-12 h-12 text-black mb-4" />
                    <h1 className="text-3xl font-bold mb-2">Help Center</h1>
                    <p className="text-gray-500">How can we assist you today?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => window.open("https://github.com/otaruram/Logistic-Dokumen-main", "_blank")}
                        className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                        <Book className="w-6 h-6 mb-2 text-black" />
                        <h3 className="font-semibold">Documentation</h3>
                        <p className="text-sm text-gray-500 mt-1">Read detailed guides</p>
                    </button>
                    <button
                        onClick={() => window.open("https://wa.link/p3ttrj", "_blank")}
                        className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                        <MessageCircle className="w-6 h-6 mb-2 text-black" />
                        <h3 className="font-semibold">Live Chat</h3>
                        <p className="text-sm text-gray-500 mt-1">Chat with support</p>
                    </button>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>

                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger className="text-left font-medium">{faq.question}</AccordionTrigger>
                                <AccordionContent className="text-gray-600">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                <div className="mt-12 text-center p-6 bg-black text-white rounded-xl">
                    <Mail className="w-8 h-8 mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">Still need help?</h3>
                    <p className="text-gray-400 text-sm mb-4">Our support team is just an email away.</p>
                    <Button
                        variant="secondary"
                        className="bg-white text-black hover:bg-gray-200"
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
