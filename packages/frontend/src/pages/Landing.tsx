import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { exclusiveAccessSignup } from "@/services/api";
import { Sparkles, ShoppingBag, Heart, ArrowRight } from "lucide-react";

const Landing = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  const handleExclusiveSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      await exclusiveAccessSignup(email.trim());
      setIsSignedUp(true);
      setEmail("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Не удалось отправить запрос. Попробуйте позже.";
      toast({
        title: "Ошибка",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const SignupForm = ({ id }: { id?: string }) => {
    if (isSignedUp) {
      return (
        <div className="flex items-center gap-2 justify-center py-3 px-4 rounded-xl bg-brand-dark/10 border border-brand/30">
          <Sparkles className="h-5 w-5 text-brand-dark" />
          <p className="text-brand-dark font-medium">Вы в списке! Мы скоро свяжемся.</p>
        </div>
      );
    }
    return (
      <form onSubmit={handleExclusiveSignup} className="flex flex-col sm:flex-row gap-3 w-full max-w-md" id={id}>
        <Input
          type="email"
          placeholder="ваш@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12 bg-input border-border/50 focus:border-brand text-foreground flex-1"
        />
        <Button
          type="submit"
          size="lg"
          className="h-12 px-6 whitespace-nowrap"
          disabled={isSubmitting}
        >
          {isSubmitting ? "..." : "Присоединиться"}
          {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-16 text-center relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 via-background to-background" />

        <div className="relative z-10 flex flex-col items-center gap-8 max-w-2xl">
          <img
            src="/assets/LogoAlt.svg"
            alt="Polka"
            className="h-20 w-20"
          />

          <div className="space-y-4">
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl tracking-tight text-brand-dark">
              Polka
            </h1>
            <p className="text-lg sm:text-xl text-brand-muted max-w-lg mx-auto leading-relaxed">
              Открывайте уникальные бренды. Листайте, вдохновляйтесь, покупайте — всё в одном приложении.
            </p>
          </div>

          <SignupForm id="hero-form" />

          <p className="text-sm text-muted-foreground">
            Эксклюзивный ранний доступ. Бесплатно.
          </p>
        </div>
      </section>

      {/* What is Polka */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <h2 className="font-display text-3xl sm:text-4xl text-brand-dark">
              Мода иначе
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Polka объединяет независимые бренды и ценителей стиля
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-surface-elevated/50">
              <div className="h-12 w-12 rounded-full bg-brand/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-brand-dark" />
              </div>
              <h3 className="font-semibold text-foreground">Уникальные бренды</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Только проверенные дизайнеры и независимые марки, которые вы не найдёте в масс-маркете
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-surface-elevated/50">
              <div className="h-12 w-12 rounded-full bg-brand/20 flex items-center justify-center">
                <Heart className="h-6 w-6 text-brand-dark" />
              </div>
              <h3 className="font-semibold text-foreground">Листайте и выбирайте</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Свайпайте через подборки, сохраняйте любимое. Алгоритм учится вашему стилю
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-surface-elevated/50">
              <div className="h-12 w-12 rounded-full bg-brand/20 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-brand-dark" />
              </div>
              <h3 className="font-semibold text-foreground">Быстрая покупка</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                От обнаружения до покупки за секунды. Безопасная оплата, доставка по всей России
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visual teaser */}
      <section className="py-16 px-4 bg-accent/30">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="font-display text-3xl sm:text-4xl text-brand-dark">
            Свайпай. Сохраняй. Покупай.
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Интерфейс, который делает шопинг интуитивным — как листать ленту, только каждый свайп ведёт к чему-то стильному
          </p>

          {/* Mockup cards */}
          <div className="flex justify-center gap-4 py-8">
            <div className="w-36 sm:w-44 h-52 sm:h-64 rounded-2xl bg-surface border border-border/50 shadow-sm flex items-end p-4 -rotate-6 hover:rotate-0 transition-transform duration-300">
              <div className="space-y-1">
                <div className="h-3 w-20 bg-brand/30 rounded" />
                <div className="h-2 w-14 bg-muted/40 rounded" />
              </div>
            </div>
            <div className="w-36 sm:w-44 h-52 sm:h-64 rounded-2xl bg-surface-elevated border border-brand/30 shadow-md flex items-end p-4 z-10 scale-105">
              <div className="space-y-1">
                <div className="h-3 w-24 bg-brand/40 rounded" />
                <div className="h-2 w-16 bg-muted/40 rounded" />
              </div>
            </div>
            <div className="w-36 sm:w-44 h-52 sm:h-64 rounded-2xl bg-surface border border-border/50 shadow-sm flex items-end p-4 rotate-6 hover:rotate-0 transition-transform duration-300">
              <div className="space-y-1">
                <div className="h-3 w-20 bg-brand/30 rounded" />
                <div className="h-2 w-14 bg-muted/40 rounded" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-md mx-auto text-center space-y-6">
          <h2 className="font-display text-3xl text-brand-dark">
            Не пропустите запуск
          </h2>
          <p className="text-muted-foreground">
            Первые участники получат ранний доступ и эксклюзивные предложения от брендов
          </p>

          <SignupForm id="footer-form" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/30">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/assets/LogoAlt.svg" alt="Polka" className="h-6 w-6" />
            <span>Polka</span>
          </div>
          <a
            href="/portal"
            className="hover:text-foreground transition-colors"
          >
            Для брендов →
          </a>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-background/95 backdrop-blur-sm border-t border-border/30 p-3 z-50">
        {isSignedUp ? (
          <div className="flex items-center gap-2 justify-center py-2">
            <Sparkles className="h-4 w-4 text-brand-dark" />
            <p className="text-sm text-brand-dark font-medium">Вы в списке!</p>
          </div>
        ) : (
          <form onSubmit={handleExclusiveSignup} className="flex gap-2">
            <Input
              type="email"
              placeholder="ваш@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 bg-input border-border/50 flex-1 text-sm"
            />
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-10 px-4">
              {isSubmitting ? "..." : "Записаться"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Landing;
