import { Sparkles, Heart, ShoppingBag } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const features = [
  {
    icon: Sparkles,
    title: "Уникальные бренды",
    desc: "Только проверенные дизайнеры и независимые марки, которые вы не найдёте в масс-маркете",
  },
  {
    icon: Heart,
    title: "Листайте и выбирайте",
    desc: "Свайпайте через подборки, сохраняйте любимое. Алгоритм учится вашему стилю",
  },
  {
    icon: ShoppingBag,
    title: "Быстрая покупка",
    desc: "От обнаружения до покупки за секунды. Безопасная оплата, доставка по всей России",
  },
];

export function FeaturesSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 px-4">
      <div ref={ref} className="max-w-4xl mx-auto text-center space-y-12">
        <div className="space-y-3">
          <h2
            className={`font-display text-3xl sm:text-4xl text-brand-dark ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          >
            Мода иначе
          </h2>
          <p
            className={`text-muted-foreground max-w-lg mx-auto ${isVisible ? "animate-reveal-up [animation-delay:0.1s]" : "opacity-0"}`}
          >
            Polka объединяет независимые бренды и ценителей стиля
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`flex flex-col items-center gap-4 p-6 rounded-2xl bg-surface-elevated/50 hover:scale-105 transition-transform duration-300 ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
                style={isVisible ? { animationDelay: `${0.15 + i * 0.12}s` } : undefined}
              >
                <div className="h-12 w-12 rounded-full bg-brand/20 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-brand-dark" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
