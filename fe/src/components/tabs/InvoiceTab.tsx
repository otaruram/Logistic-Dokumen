import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, FileText, Download, Eye, Trash2, Share2, Copy, Calculator, FileCheck, FileSignature, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import InvoiceUtilsTab from "./InvoiceUtilsTab";

interface InvoiceTabProps {
  onBack: () => void;
}

interface InvoiceTemplate {
  id: number;
  name: string;
  description: string;
  preview: string;
  color: string;
}

interface InvoiceData {
  id: number;
  templateId: number;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  date: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  notes: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
}

const TEMPLATES: InvoiceTemplate[] = [
  {
    id: 1,
    name: "Modern Minimal",
    description: "Clean and minimal design with clear typography",
    preview: "🎨",
    color: "from-slate-500 to-slate-700",
  },
  {
    id: 2,
    name: "Professional Blue",
    description: "Classic professional template with blue accents",
    preview: "💼",
    color: "from-blue-500 to-blue-700",
  },
  {
    id: 3,
    name: "Elegant Green",
    description: "Sophisticated design with green highlights",
    preview: "🌿",
    color: "from-green-500 to-green-700",
  },
  {
    id: 4,
    name: "Corporate Gray",
    description: "Traditional corporate style with gray tones",
    preview: "🏢",
    color: "from-gray-500 to-gray-700",
  },
  {
    id: 5,
    name: "Creative Orange",
    description: "Modern creative template with orange touches",
    preview: "🎯",
    color: "from-orange-500 to-orange-700",
  },
  {
    id: 6,
    name: "Tech Purple",
    description: "Contemporary tech-focused design with purple",
    preview: "⚡",
    color: "from-purple-500 to-purple-700",
  },
  {
    id: 7,
    name: "Simple Black",
    description: "Bold and simple monochrome design",
    preview: "⚫",
    color: "from-zinc-700 to-zinc-900",
  },
  {
    id: 8,
    name: "Fresh Teal",
    description: "Fresh and modern with teal accents",
    preview: "🌊",
    color: "from-teal-500 to-teal-700",
  },
  {
    id: 9,
    name: "Warm Red",
    description: "Energetic design with warm red tones",
    preview: "🔥",
    color: "from-red-500 to-red-700",
  },
  {
    id: 10,
    name: "Custom Design",
    description: "Create your own custom invoice template",
    preview: "✨",
    color: "from-indigo-500 to-indigo-700",
  },
];

const InvoiceTab = ({ onBack }: InvoiceTabProps) => {
  const [activeUtilTool, setActiveUtilTool] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, price: 0 }]);
  const [notes, setNotes] = useState("");

  // If showing utils tool, render InvoiceUtilsTab with specific tool
  if (activeUtilTool) {
    return <InvoiceUtilsTab onBack={() => setActiveUtilTool(null)} initialTool={activeUtilTool} />;
  }

  const handleTemplateSelect = (template: InvoiceTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateDialog(false);
    setShowCreateDialog(true);
  };

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof typeof items[0],
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const calculateTax = (subtotal: number) => {
    return subtotal * 0.11; // 11% PPN
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    return subtotal + tax;
  };

  const handleCreateInvoice = () => {
    if (!selectedTemplate) {
      toast.error("Pilih template terlebih dahulu");
      return;
    }

    if (!invoiceNumber || !clientName) {
      toast.error("Nomor invoice dan nama klien wajib diisi");
      return;
    }

    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    const total = calculateTotal();

    const newInvoice: InvoiceData = {
      id: Date.now(),
      templateId: selectedTemplate.id,
      invoiceNumber,
      clientName,
      clientEmail,
      clientAddress,
      date,
      dueDate,
      items: items.filter((item) => item.description && item.price > 0),
      notes,
      subtotal,
      tax,
      total,
      createdAt: new Date().toISOString(),
    };

    setInvoices([newInvoice, ...invoices]);
    setShowCreateDialog(false);
    resetForm();
    toast.success("Invoice berhasil dibuat!");
  };

  const resetForm = () => {
    setInvoiceNumber("");
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setItems([{ description: "", quantity: 1, price: 0 }]);
    setNotes("");
    setSelectedTemplate(null);
  };

  const handleDeleteInvoice = (id: number) => {
    setInvoices(invoices.filter((inv) => inv.id !== id));
    toast.success("Invoice dihapus");
  };

  const handlePreview = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setShowPreviewDialog(true);
  };

  const handleDownload = async (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setShowPreviewDialog(true);
    
    setTimeout(async () => {
      if (previewRef.current) {
        try {
          const canvas = await html2canvas(previewRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
          });
          
          const link = document.createElement("a");
          link.download = `invoice-${invoice.invoiceNumber}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          
          toast.success("Invoice berhasil didownload!");
        } catch (error) {
          toast.error("Gagal download invoice");
          console.error(error);
        }
      }
    }, 500);
  };

  const handleShare = async (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setShowPreviewDialog(true);
    
    setTimeout(async () => {
      if (previewRef.current) {
        try {
          const canvas = await html2canvas(previewRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
          });
          
          canvas.toBlob(async (blob) => {
            if (!blob) {
              toast.error("Gagal membuat image");
              return;
            }

            const formData = new FormData();
            formData.append("file", blob, `invoice-${invoice.invoiceNumber}.png`);

            const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
            
            const response = await fetch(`${API_BASE_URL}/api/upload-invoice`, {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              throw new Error("Upload failed");
            }

            const data = await response.json();
            setShareUrl(data.url);
            setShowShareDialog(true);
            toast.success("Link share berhasil dibuat!");
          }, "image/png");
        } catch (error) {
          toast.error("Gagal membuat link share");
          console.error(error);
        }
      }
    }, 500);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link berhasil dicopy!");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">audit.wtf</h2>
            <p className="text-xs sm:text-sm text-gray-600">
              AI-powered invoice fraud detection
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-4">
        {invoices.length === 0 ? (
          <>
            {/* Hero: Create Invoice Button */}
            <Card 
              onClick={() => setShowTemplateDialog(true)}
              className="p-8 sm:p-12 text-center border-4 border-black hover:bg-black hover:text-white transition-all cursor-pointer group"
              style={{ boxShadow: '8px 8px 0 0 rgba(0,0,0,1)' }}
            >
              <Plus className="w-16 h-16 mx-auto mb-4 stroke-[2]" />
              <h3 className="text-2xl font-bold mb-2">BUAT INVOICE BARU</h3>
              <p className="text-sm opacity-60">
                Pilih template dan mulai buat invoice professional
              </p>
            </Card>

            {/* Admin Tools Grid */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-4 px-1">Admin Tools</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Terbilang Generator */}
                <Card
                  onClick={() => setActiveUtilTool('terbilang')}
                  className="p-6 border-2 border-black hover:bg-black hover:text-white transition-all cursor-pointer group"
                  style={{ boxShadow: '4px 4px 0 0 rgba(0,0,0,1)' }}
                >
                  <Calculator className="w-10 h-10 mb-3 stroke-[1.5]" />
                  <h4 className="font-bold text-sm mb-1">🗣️ Terbilang</h4>
                  <p className="text-xs opacity-60">Convert angka ke text</p>
                </Card>

                {/* NPWP Validator */}
                <Card
                  onClick={() => setActiveUtilTool('npwp')}
                  className="p-6 border-2 border-black hover:bg-black hover:text-white transition-all cursor-pointer group"
                  style={{ boxShadow: '4px 4px 0 0 rgba(0,0,0,1)' }}
                >
                  <FileCheck className="w-10 h-10 mb-3 stroke-[1.5]" />
                  <h4 className="font-bold text-sm mb-1">🏷️ Cek NPWP</h4>
                  <p className="text-xs opacity-60">Validator NPWP</p>
                </Card>

                {/* Smart Filename */}
                <Card
                  onClick={() => setActiveUtilTool('filename')}
                  className="p-6 border-2 border-black hover:bg-black hover:text-white transition-all cursor-pointer group"
                  style={{ boxShadow: '4px 4px 0 0 rgba(0,0,0,1)' }}
                >
                  <FileSignature className="w-10 h-10 mb-3 stroke-[1.5]" />
                  <h4 className="font-bold text-sm mb-1">🔢 Smart Rename</h4>
                  <p className="text-xs opacity-60">Auto filename generator</p>
                </Card>

                {/* Invoice Archive */}
                <Card
                  onClick={() => toast.info('Feature coming soon')}
                  className="p-6 border-2 border-gray-300 hover:border-black transition-all cursor-pointer opacity-60"
                  style={{ boxShadow: '4px 4px 0 0 rgba(200,200,200,1)' }}
                >
                  <FolderOpen className="w-10 h-10 mb-3 stroke-[1.5]" />
                  <h4 className="font-bold text-sm mb-1">📂 Arsip</h4>
                  <p className="text-xs">Invoice history</p>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Action Buttons when invoices exist */}
            <div className="flex gap-3">
              <Button
                onClick={() => setShowTemplateDialog(true)}
                className="flex-1 bg-black hover:bg-gray-800 h-14"
              >
                <Plus className="h-5 w-5 mr-2" />
                Buat Invoice Baru
              </Button>
            </div>

            {/* Invoice List */}
            {invoices.map((invoice) => {
            const template = TEMPLATES.find((t) => t.id === invoice.templateId);
            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{template?.preview}</span>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {invoice.invoiceNumber}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {template?.name}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                        <div>
                          <span className="text-muted-foreground">Klien:</span>{" "}
                          <span className="font-medium">{invoice.clientName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tanggal:</span>{" "}
                          {invoice.date}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{" "}
                          <span className="font-semibold">
                            {formatCurrency(invoice.total)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Jatuh Tempo:</span>{" "}
                          {invoice.dueDate || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handlePreview(invoice)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleDownload(invoice)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleShare(invoice)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
          </>
        )}
      </div>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pilih Template Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-4">
            {TEMPLATES.map((template) => (
              <motion.div
                key={template.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card
                  className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
                    selectedTemplate?.id === template.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div
                    className={`w-full aspect-[3/4] rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center text-4xl mb-3`}
                  >
                    {template.preview}
                  </div>
                  <h4 className="font-medium text-sm mb-1">{template.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Invoice - {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Nomor Invoice *</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Client Info */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="font-medium text-sm">Informasi Klien</h4>
              <div className="space-y-2">
                <Label htmlFor="clientName">Nama Klien *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="PT. Company Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Jatuh Tempo</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientAddress">Alamat</Label>
                <Textarea
                  id="clientAddress"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Alamat lengkap klien"
                  rows={2}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Item</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Tambah Item
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-6 space-y-1">
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                      placeholder="Deskripsi item"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", parseInt(e.target.value) || 0)
                      }
                      placeholder="Qty"
                      min="1"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) =>
                        handleItemChange(index, "price", parseFloat(e.target.value) || 0)
                      }
                      placeholder="Harga"
                      min="0"
                      className="text-sm"
                    />
                  </div>
                  {items.length > 1 && (
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pajak (11%):</span>
                <span className="font-medium">
                  {formatCurrency(calculateTax(calculateSubtotal()))}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t">
                <span>Total:</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                Batal
              </Button>
              <Button onClick={handleCreateInvoice}>Buat Invoice</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Invoice</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div ref={previewRef} className="p-8 bg-white">
              {/* Invoice Header */}
              <div className={`bg-gradient-to-r ${TEMPLATES.find((t) => t.id === selectedInvoice.templateId)?.color} text-white p-6 rounded-t-lg`}>
                <h1 className="text-3xl font-bold mb-2">INVOICE</h1>
                <p className="text-xl">{selectedInvoice.invoiceNumber}</p>
              </div>

              {/* Invoice Details */}
              <div className="p-6 border-x border-b rounded-b-lg">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold text-sm text-gray-600 mb-2">Bill To:</h3>
                    <p className="font-bold text-lg">{selectedInvoice.clientName}</p>
                    {selectedInvoice.clientEmail && <p className="text-sm">{selectedInvoice.clientEmail}</p>}
                    {selectedInvoice.clientAddress && <p className="text-sm whitespace-pre-line">{selectedInvoice.clientAddress}</p>}
                  </div>
                  <div className="text-right">
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Date: </span>
                      <span className="font-medium">{selectedInvoice.date}</span>
                    </div>
                    {selectedInvoice.dueDate && (
                      <div>
                        <span className="text-sm text-gray-600">Due Date: </span>
                        <span className="font-medium">{selectedInvoice.dueDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full mb-6">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold">Description</th>
                      <th className="text-center p-3 text-sm font-semibold w-20">Qty</th>
                      <th className="text-right p-3 text-sm font-semibold w-32">Price</th>
                      <th className="text-right p-3 text-sm font-semibold w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3 text-sm">{item.description}</td>
                        <td className="p-3 text-sm text-center">{item.quantity}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(item.price)}</td>
                        <td className="p-3 text-sm text-right font-medium">
                          {formatCurrency(item.quantity * item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary */}
                <div className="flex justify-end">
                  <div className="w-64">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Tax (11%):</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.tax)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-gray-300">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold text-lg">{formatCurrency(selectedInvoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-sm mb-2">Notes:</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invoice berhasil diupload ke ImageKit. Gunakan link di bawah untuk share:
            </p>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button onClick={copyShareLink} size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(shareUrl, "_blank")}
              >
                <Eye className="h-4 w-4 mr-2" />
                Lihat
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = shareUrl;
                  link.download = `invoice-${selectedInvoice?.invoiceNumber}.png`;
                  link.click();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceTab;
