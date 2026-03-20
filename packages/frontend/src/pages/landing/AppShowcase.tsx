import { Sun, Moon } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useParallax } from "@/hooks/useParallax";

interface AppShowcaseProps {
  screenshotTheme: "dark" | "light";
  onToggleTheme: () => void;
}

export function AppShowcase({ screenshotTheme, onToggleTheme }: AppShowcaseProps) {
  const { ref, isVisible } = useScrollReveal();
  const offset = useParallax();

  return (
    <section className="py-16 px-4 bg-accent/30 overflow-hidden">
      <div ref={ref} className="max-w-3xl mx-auto text-center space-y-8">
        <div className="relative">
          <h2
            className={`font-display text-3xl sm:text-4xl text-brand-dark ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          >
            Свайпай. Сохраняй. Покупай.
          </h2>
          <p
            className={`text-muted-foreground max-w-md mx-auto mt-3 ${isVisible ? "animate-reveal-up [animation-delay:0.1s]" : "opacity-0"}`}
          >
            Интерфейс, который делает шопинг интуитивным — как листать ленту,
            только каждый свайп ведёт к чему-то стильному
          </p>
          <div className="absolute top-1 right-0">
            <button
              onClick={onToggleTheme}
              className="relative w-14 h-7 rounded-full bg-surface-elevated border border-border/50 transition-colors duration-300 flex items-center px-1"
              aria-label="Toggle screenshot theme"
            >
              <div
                className={`absolute w-5 h-5 rounded-full bg-brand/80 transition-transform duration-300 flex items-center justify-center ${
                  screenshotTheme === "light" ? "translate-x-7" : "translate-x-0"
                }`}
              >
                {screenshotTheme === "dark" ? (
                  <Moon className="h-3 w-3 text-background" />
                ) : (
                  <Sun className="h-3 w-3 text-background" />
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-4 py-8">
          <div
            className={`w-36 sm:w-44 aspect-[9/19.5] rounded-2xl overflow-hidden shadow-lg -rotate-6 hover:rotate-0 transition-transform duration-300 ${isVisible ? "animate-reveal-right" : "opacity-0"}`}
            style={{ transform: `translateY(${offset * 0.03}px) rotate(-6deg)` }}
          >
            <img
              src={`/assets/screenshots/${screenshotTheme}-favorites.png`}
              alt="Favorites"
              className="w-full h-full object-cover"
            />
          </div>
          <div
            className={`w-36 sm:w-44 aspect-[9/19.5] rounded-2xl overflow-hidden border border-brand/30 shadow-xl z-10 scale-105 ${isVisible ? "animate-reveal-up [animation-delay:0.1s]" : "opacity-0"}`}
          >
            <img
              src={`/assets/screenshots/${screenshotTheme}-main.png`}
              alt="Swipe discovery"
              className="w-full h-full object-cover"
            />
          </div>
          <div
            className={`w-36 sm:w-44 aspect-[9/19.5] rounded-2xl overflow-hidden shadow-lg rotate-6 hover:rotate-0 transition-transform duration-300 ${isVisible ? "animate-reveal-left" : "opacity-0"}`}
            style={{ transform: `translateY(${offset * 0.03}px) rotate(6deg)` }}
          >
            <img
              src={`/assets/screenshots/${screenshotTheme}-cart.png`}
              alt="Cart"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
