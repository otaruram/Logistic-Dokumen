import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Send } from "lucide-react";
import { apiFetch } from "@/lib/api-service";
import { toast } from "sonner";

const EMOJIS = ["🔥", "😎", "🚀", "💀", "🤩", "🤡", "💩", "🤖"];

interface RatingDialogProps {
  user: any;
  triggerButton: React.ReactNode;
}

export default function RatingDialog({ user, triggerButton }: RatingDialogProps) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [selectedEmoji, setSelectedEmoji] = useState("🔥");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return toast.error("Tulis pesan dulu dong!");
    
    setIsSubmitting(true);
    try {
      const response = await apiFetch("/rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.credential}`
        },
        body: JSON.stringify({
          stars,
          emoji: selectedEmoji,
          message,
          userName: user.name,
          userAvatar: user.picture
        })
      });

      if (response.ok) {
        toast.success("Rating terkirim! Muncul di Landing Page.");
        setOpen(false);
        setMessage("");
      } else {
        toast.error("Gagal kirim rating.");
      }
    } catch {
      toast.error("Error koneksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="brutal-border bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase text-center mb-2">
            RATE THIS APP!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Bintang */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-8 h-8 cursor-pointer transition-all hover:scale-110 ${s <= stars ? "fill-yellow-400 text-black" : "text-gray-300"}`}
                onClick={() => setStars(s)}
              />
            ))}
          </div>

          {/* Emoji Selector */}
          <div>
            <label className="block text-xs font-bold uppercase mb-2 text-center">Pilih Mood Kamu</label>
            <div className="flex flex-wrap justify-center gap-3">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setSelectedEmoji(e)}
                  className={`text-2xl w-10 h-10 flex items-center justify-center border-2 transition-all ${
                    selectedEmoji === e 
                      ? "border-black bg-yellow-200 shadow-[2px_2px_0px_0px_black] -translate-y-1" 
                      : "border-transparent hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-xs font-bold uppercase mb-2">Kesan & Pesan</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Aplikasi ini gokil karena..."
              className="w-full h-24 p-3 font-mono text-sm border-2 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_black] transition-all resize-none"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full h-12 text-lg font-black uppercase brutal-border-thin border-black bg-black text-white hover:bg-gray-800 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all"
          >
            {isSubmitting ? "MENGIRIM..." : <>KIRIM RATING <Send className="ml-2 w-4 h-4" /></>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
