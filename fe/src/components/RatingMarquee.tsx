import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { apiFetch } from "@/lib/api-service";

export default function RatingMarquee() {
  const [ratings, setRatings] = useState<any[]>([]);

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const res = await apiFetch("/ratings");
        const json = await res.json();
        if (json.status === "success") setRatings(json.data);
      } catch (e) { console.error(e); }
    };
    fetchRatings();
  }, []);

  if (ratings.length === 0) return null;

  return (
    <div className="w-full overflow-hidden bg-yellow-400 border-y-4 border-black py-6 mb-12 relative group">
      {/* Animasi Container */}
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
        {/* Render 2x untuk efek infinite loop seamless */}
        {[...ratings, ...ratings].map((rating, i) => (
          <div 
            key={`${rating.id}-${i}`}
            className="mx-4 w-[300px] shrink-0 bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3 hover:translate-y-[-4px] transition-transform"
          >
            <div className="flex items-center gap-3 border-b-2 border-black pb-2">
              {/* Fallback jika avatar rusak/kosong */}
              <img 
                src={rating.userAvatar || "https://placehold.co/40x40?text=?"} 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-black object-cover" 
              />
              <div>
                <h4 className="font-bold text-sm uppercase truncate w-32">{rating.userName}</h4>
                <div className="flex">
                  {[...Array(rating.stars)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-black text-black" />
                  ))}
                </div>
              </div>
              <div className="ml-auto text-2xl">{rating.emoji}</div>
            </div>
            <p className="font-mono text-xs italic line-clamp-3">"{rating.message}"</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
