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
    <div className="w-full overflow-hidden bg-yellow-400 dark:bg-yellow-600 border-y-4 border-black dark:border-white py-6 mb-12 relative group transition-colors duration-300">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
        {[...ratings, ...ratings].map((rating, i) => (
          <div 
            key={`${rating.id}-${i}`}
            // PERBAIKAN DARK MODE DI SINI:
            className="mx-4 w-[300px] shrink-0 bg-white dark:bg-zinc-900 border-4 border-black dark:border-zinc-400 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.5)] flex flex-col gap-3 hover:translate-y-[-4px] transition-all"
          >
            <div className="flex items-center gap-3 border-b-2 border-black dark:border-zinc-600 pb-2">
              <img 
                src={rating.userAvatar || "https://placehold.co/40x40?text=?"} 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-black dark:border-white object-cover" 
              />
              <div>
                <h4 className="font-bold text-sm uppercase truncate w-32 text-black dark:text-white">{rating.userName}</h4>
                <div className="flex">
                  {[...Array(rating.stars)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-black text-black dark:fill-yellow-400 dark:text-yellow-400" />
                  ))}
                </div>
              </div>
              <div className="ml-auto text-2xl">{rating.emoji}</div>
            </div>
            <p className="font-mono text-xs italic line-clamp-3 text-black dark:text-gray-300">"{rating.message}"</p>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 40s linear infinite; }
      `}</style>
    </div>
  );
}
