import { useScrollReveal } from "@/hooks/useScrollReveal";
import { SignupForm } from "./SignupForm";

interface HeroSectionProps {
  email: string;
  isSubmitting: boolean;
  isSignedUp: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function HeroSection({
  email,
  isSubmitting,
  isSignedUp,
  onEmailChange,
  onSubmit,
}: HeroSectionProps) {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-16 text-center relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 hero-gradient animate-gradient-shift" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />

      {/* Floating dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[15%] left-[10%] w-2 h-2 rounded-full bg-brand/30 animate-float-slow" />
        <div className="absolute top-[25%] right-[15%] w-3 h-3 rounded-full bg-brand/20 animate-float-medium" />
        <div className="absolute bottom-[30%] left-[20%] w-2.5 h-2.5 rounded-full bg-brand/25 animate-float-slow [animation-delay:2s]" />
        <div className="absolute top-[40%] right-[25%] w-1.5 h-1.5 rounded-full bg-brand/20 animate-float-medium [animation-delay:1s]" />
        <div className="absolute bottom-[20%] right-[10%] w-2 h-2 rounded-full bg-brand/30 animate-float-slow [animation-delay:3s]" />
      </div>

      <div
        ref={ref}
        className={`relative z-10 flex flex-col items-center gap-8 max-w-2xl ${isVisible ? "opacity-100" : "opacity-0"}`}
      >
        <img
          src="/assets/LogoAlt.svg"
          alt="Polka"
          className={`h-20 w-20 ${isVisible ? "animate-reveal-scale" : "opacity-0"}`}
        />

        <div className="space-y-4">
          <h1
            className={`font-display text-6xl sm:text-7xl md:text-8xl tracking-tight text-brand-dark ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          >
            Polka
          </h1>
          <p
            className={`text-lg sm:text-xl text-brand-muted max-w-lg mx-auto leading-relaxed ${isVisible ? "animate-reveal-up [animation-delay:0.15s]" : "opacity-0"}`}
          >
            Открывайте уникальные бренды. Листайте, вдохновляйтесь, покупайте
            — всё в одном приложении.
          </p>
        </div>

        <div className={isVisible ? "animate-reveal-up [animation-delay:0.3s]" : "opacity-0"}>
          <SignupForm
            id="hero-form"
            email={email}
            isSubmitting={isSubmitting}
            isSignedUp={isSignedUp}
            onEmailChange={onEmailChange}
            onSubmit={onSubmit}
          />
        </div>

        <p
          className={`text-sm text-muted-foreground ${isVisible ? "animate-reveal-up [animation-delay:0.45s]" : "opacity-0"}`}
        >
          Эксклюзивный ранний доступ. Бесплатно.
        </p>
      </div>
    </section>
  );
}
