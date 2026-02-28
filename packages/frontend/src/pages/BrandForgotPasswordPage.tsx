import { useState, useEffect } from "react";
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
import { ArrowLeft, Mail, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as api from "@/services/api";

const BrandForgotPasswordPage = () => {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите email бренда.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await api.brandRequestPasswordReset(email.trim());
      setIsSuccess(true);
    } catch (error: unknown) {
      console.error("Password reset request failed:", error);
      const err = error as { message?: string; status?: number };

      let errorMessage = "Произошла ошибка при отправке кода сброса пароля.";

      if (err.status === 0) {
        errorMessage =
          "Проблемы с подключением к интернету. Проверьте соединение и попробуйте снова.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    navigate("/portal");
  };

  const handleContinueToReset = () => {
    navigate("/portal/reset-password", { state: { email } });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img
              src="/assets/Logo.svg"
              alt="Polka Logo"
              className="mx-auto h-20 w-20 mb-4"
            />
            <h1 className="text-2xl font-bold text-foreground mb-2">Polka</h1>
            <p className="text-muted-foreground">Сброс пароля бренда</p>
          </div>

          <Card className="bg-card/90 backdrop-blur border-border/30">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-green-400" />
              </div>
              <CardTitle>Код отправлен</CardTitle>
              <CardDescription>
                Мы отправили код сброса пароля на {email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleContinueToReset}
                variant="default"
                size="lg"
                className="w-full"
              >
                <Shield className="mr-2 h-4 w-4" />
                Продолжить сброс пароля
              </Button>

              <Button
                onClick={handleBackToLogin}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Вернуться к входу
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="/assets/Logo.svg"
            alt="Polka Logo"
            className="mx-auto h-20 w-20 mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground mb-2">Polka</h1>
          <p className="text-muted-foreground">Сброс пароля бренда</p>
        </div>

        <Card className="bg-card/90 backdrop-blur border-border/30">
          <CardHeader>
            <CardTitle className="text-center">Забыли код доступа?</CardTitle>
            <CardDescription className="text-center">
              Введите email вашего бренда, и мы отправим код для сброса пароля
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email бренда"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-input border-border/50 focus:border-brand"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full"
                disabled={isSubmitting || !email.trim()}
              >
                <Mail className="mr-2 h-4 w-4" />
                {isSubmitting ? "Отправка кода..." : "Отправить код"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
              >
                ← Вернуться к входу
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BrandForgotPasswordPage;



