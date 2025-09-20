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
import { LogIn, Shield } from "lucide-react";
import * as api from "@/services/api";
import { BrandLoginRequest } from "@/services/api";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { useNavigate } from "react-router-dom"; // Import useNavigate

const Portal = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth(); // Use the login function from AuthContext
  const navigate = useNavigate(); // Initialize useNavigate

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите email бренда.",
        variant: "destructive",
      });
      return;
    }

    if (!password.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите код доступа.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const credentials: BrandLoginRequest = { email: email.trim(), password };

      // Add timeout to prevent hanging
      const loginPromise = login(credentials);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Время ожидания истекло. Попробуйте снова.")),
          30000
        )
      );

      await Promise.race([loginPromise, timeoutPromise]);
      navigate("/dashboard"); // Use navigate for redirection
    } catch (error: any) {
      console.error("Brand login failed:", error);

      // Provide more specific error messages based on error type
      let errorMessage = "Произошла ошибка при входе в систему.";

      if (error.status === 401) {
        errorMessage =
          "Неверные учетные данные. Проверьте правильность email и кода доступа.";
      } else if (error.status === 0) {
        errorMessage =
          "Проблемы с подключением к интернету. Проверьте соединение и попробуйте снова.";
      } else if (error.message?.includes("Время ожидания истекло")) {
        errorMessage =
          "Время ожидания истекло. Проверьте подключение к интернету и попробуйте снова.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Ошибка входа",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-ominous flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/assets/Logo.svg"
            alt="Polka Logo"
            className="mx-auto h-20 w-20"
          />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Портал брендов Polka
          </h1>
          <p className="text-muted-foreground">Зона ограниченного доступа</p>
        </div>

        <Card className="bg-card/90 backdrop-blur border-brown-light/30 shadow-ominous">
          <CardHeader>
            <CardTitle className="text-center">Безопасный доступ</CardTitle>
            <CardDescription className="text-center">
              Введите ваши учетные данные для доступа к порталу
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email бренда"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 border-brown-light/30 focus:border-brown-light"
                />
              </div>

              <div>
                <Input
                  type="password"
                  placeholder="Код доступа"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50 border-brown-light/30 focus:border-brown-light"
                />
              </div>

              <Button
                type="submit"
                variant="ominous"
                size="lg"
                className="w-full"
                disabled={isSubmitting || !email.trim() || !password.trim()}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {isSubmitting ? "Проверка данных..." : "Доступ к порталу"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <a
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Вернуться на главный сайт
          </a>
        </div>
      </div>
    </div>
  );
};

export default Portal;
