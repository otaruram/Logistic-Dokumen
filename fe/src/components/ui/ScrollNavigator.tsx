import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export default function ScrollNavigator({
  target = typeof window !== "undefined" ? window : null,
  bottomOffsetClass = "bottom-24",
}: {
  target?: Window | HTMLElement | null;
  bottomOffsetClass?: string;
}) {
  const [y, setY] = useState(0);

  const maxScroll = useMemo(() => {
    if (!target) return 0;
    if (target instanceof Window) {
      const doc = document.documentElement;
      return Math.max(0, doc.scrollHeight - window.innerHeight);
    }
    return Math.max(0, target.scrollHeight - target.clientHeight);
  }, [target, y]);

  useEffect(() => {
    if (!target) return;
    const update = () => {
      if (target instanceof Window) {
        setY(window.scrollY || document.documentElement.scrollTop || 0);
      } else {
        setY(target.scrollTop || 0);
      }
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    return () => target.removeEventListener("scroll", update);
  }, [target]);

  const canScrollUp = y > 120;
  const canScrollDown = y < maxScroll - 120;

  const smoothScroll = (toBottom: boolean) => {
    if (!target) return;
    if (target instanceof Window) {
      window.scrollTo({ top: toBottom ? document.documentElement.scrollHeight : 0, behavior: "smooth" });
      return;
    }
    target.scrollTo({ top: toBottom ? target.scrollHeight : 0, behavior: "smooth" });
  };

  if (!canScrollUp && !canScrollDown) return null;

  return (
    <div className={`fixed right-3 z-50 ${bottomOffsetClass} flex flex-col gap-2 md:right-5`}>
      {canScrollUp && (
        <button
          type="button"
          onClick={() => smoothScroll(false)}
          aria-label="Scroll ke atas"
          className="h-10 w-10 rounded-full border border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800 active:scale-95 md:h-11 md:w-11"
        >
          <ArrowUp className="mx-auto h-4 w-4 md:h-5 md:w-5" />
        </button>
      )}
      {canScrollDown && (
        <button
          type="button"
          onClick={() => smoothScroll(true)}
          aria-label="Scroll ke bawah"
          className="h-10 w-10 rounded-full border border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800 active:scale-95 md:h-11 md:w-11"
        >
          <ArrowDown className="mx-auto h-4 w-4 md:h-5 md:w-5" />
        </button>
      )}
    </div>
  );
}
