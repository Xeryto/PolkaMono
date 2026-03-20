import { useScrollReveal } from "@/hooks/useScrollReveal";
import { SignupForm } from "./SignupForm";

interface CtaSectionProps {
  email: string;
  isSubmitting: boolean;
  isSignedUp: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CtaSection({
  email,
  isSubmitting,
  isSignedUp,
  onEmailChange,
  onSubmit,
}: CtaSectionProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 px-4">
      <div
        ref={ref}
        className={`max-w-md mx-auto text-center space-y-6 ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
      >
        <div className="p-8 rounded-2xl border border-brand/20 bg-surface-elevated/30">
          <h2 className="font-display text-3xl text-brand-dark">
            Не пропустите запуск
          </h2>
          <p className="text-muted-foreground mt-3 mb-6">
            Первые участники получат ранний доступ и эксклюзивные предложения от
            брендов
          </p>

          <SignupForm
            id="footer-form"
            email={email}
            isSubmitting={isSubmitting}
            isSignedUp={isSignedUp}
            onEmailChange={onEmailChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </section>
  );
}
