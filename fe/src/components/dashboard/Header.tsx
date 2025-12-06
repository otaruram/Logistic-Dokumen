import { Circle } from "lucide-react";

const Header = () => {
  return (
    <header className="brutal-border-thin border-t-0 border-l-0 border-r-0 bg-background">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <h1 className="text-lg md:text-2xl font-bold tracking-tighter">
          LOGISTIC.AI OCR
        </h1>
        <div className="flex items-center gap-2 brutal-border-thin px-3 py-1.5 md:px-4 md:py-2 bg-background">
          <Circle className="w-2.5 h-2.5 md:w-3 md:h-3 fill-success text-success" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">
            SYSTEM ONLINE
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
