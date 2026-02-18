import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { exclusiveAccessSignup } from "@/services/api";

const Landing = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleExclusiveSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await exclusiveAccessSignup(email.trim());
      toast({
        title: "Запрос на доступ",
        description:
          "Вы добавлены в наш список эксклюзивного доступа. Мы скоро свяжемся с вами.",
      });
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

  return (
    <div className="min-h-screen bg-gradient-ominous flex items-center justify-center p-4">
      <Card className="bg-card-custom border-brown-light/30 shadow-power w-full max-w-md">
        <CardHeader>
          <img
            src="/assets/LogoAlt.svg"
            alt="Polka Logo"
            className="mx-auto h-20 w-20"
          />
          <CardTitle className="text-center text-2xl font-bold text-card-custom-text">
            Polka
          </CardTitle>
          <CardDescription className="text-center text-card-custom-text/80">
            Введите ваш email, чтобы попасть в список.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExclusiveSignup} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="ваш@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 border-brown-light/30 focus:border-brown-light h-12 text-center"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 bg-button-custom hover:bg-button-custom/90 text-card-custom border-0"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Отправка..." : "Присоединиться"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Landing;
