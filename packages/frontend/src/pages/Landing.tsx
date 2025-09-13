import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Landing = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleExclusiveSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Mock API call to /api/v1/exclusive-access-signup
    setTimeout(() => {
      toast({
        title: "Запрос на доступ",
        description: "Вы добавлены в наш список эксклюзивного доступа. Мы скоро свяжемся с вами.",
      });
      setEmail("");
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-ominous flex items-center justify-center p-4">
        <Card className="bg-card/80 backdrop-blur border-brown-light/30 shadow-power w-full max-w-md">
          <CardHeader>
                        <img src="/assets/Logo.svg" alt="Polka Logo" className="mx-auto h-20 w-20" />
            <CardTitle className="text-center text-2xl font-bold">Polka</CardTitle>
            <CardDescription className="text-center">
              Введите ваш email, чтобы присоединиться к списку ожидания.
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
                variant="ominous" 
                size="lg" 
                className="w-full h-12"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Отправка..." : "Запросить доступ"}
              </Button>
            </form>
          </CardContent>
        </Card>
    </div>
  );
};

export default Landing;