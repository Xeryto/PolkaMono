import { useScrollReveal } from "@/hooks/useScrollReveal";

const steps = [
  { num: "1", title: "Листайте", desc: "Откройте приложение и свайпайте карточки брендов — каждый свайп подбирает стиль под вас" },
  { num: "2", title: "Находите", desc: "Сохраняйте любимые находки, исследуйте коллекции и получайте персональные подборки" },
  { num: "3", title: "Покупайте", desc: "Оформите заказ в пару касаний — безопасная оплата и доставка по всей России" },
];

export function HowItWorks() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 px-4 bg-accent/20">
      <div ref={ref} className="max-w-4xl mx-auto text-center space-y-12">
        <h2
          className={`font-display text-3xl sm:text-4xl text-brand-dark ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
        >
          Как это работает
        </h2>

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start justify-center gap-8 sm:gap-4">
          {/* Dashed connector line (desktop) */}
          <div className="hidden sm:block absolute top-10 left-[20%] right-[20%] border-t-2 border-dashed border-brand/30" />

          {steps.map((step, i) => (
            <div
              key={step.num}
              className={`relative flex flex-col items-center gap-3 flex-1 max-w-[240px] ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
              style={isVisible ? { animationDelay: `${0.1 + i * 0.15}s` } : undefined}
            >
              <div className="relative z-10 w-14 h-14 rounded-full bg-brand text-primary-foreground flex items-center justify-center text-xl font-bold">
                {step.num}
              </div>
              <h3 className="font-semibold text-foreground text-lg">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
