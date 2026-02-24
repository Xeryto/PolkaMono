import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";
import * as api from "@/services/api";
import { BrandLoginRequest } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const Portal = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP challenge state
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otpSessionToken, setOtpSessionToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  const { toast } = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleLoginSuccess = (token: string, user: api.UserProfileResponse) => {
    // Store token + user in localStorage and AuthContext
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUser", JSON.stringify(user));
    // Trigger auth state update via a page-level reload into dashboard
    navigate("/dashboard");
    // Force a full context refresh by dispatching a storage event isn't reliable;
    // navigate will re-mount Dashboard which reads from localStorage via AuthContext
    window.location.href = "/dashboard";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({ title: "Ошибка", description: "Пожалуйста, введите email бренда.", variant: "destructive" });
      return;
    }
    if (!password.trim()) {
      toast({ title: "Ошибка", description: "Пожалуйста, введите код доступа.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const credentials: BrandLoginRequest = { email: email.trim(), password };
      const response = await api.brandLogin(credentials);

      // Check for 2FA challenge (otp_required in response)
      if ((response as any).otp_required) {
        setOtpSessionToken((response as any).session_token);
        setShowOtpStep(true);
        setResendCountdown(60);
        setResendCount(1);
        return;
      }

      // Normal login: delegate to AuthContext login
      await login(credentials);
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Brand login failed:", error);
      let errorMessage = "Произошла ошибка при входе в систему.";
      if (error.status === 401) {
        errorMessage = "Неверные учетные данные. Проверьте правильность email и кода доступа.";
      } else if (error.status === 0) {
        errorMessage = "Проблемы с подключением к интернету. Проверьте соединение и попробуйте снова.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Ошибка входа", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setIsSubmitting(true);
    setOtpError("");
    try {
      const result = await api.verify2FA(otpSessionToken, otpCode);
      handleLoginSuccess(result.token, result.user);
    } catch (error: any) {
      setOtpError(error.message || "Неверный код");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || resendCount >= 3) return;
    setIsSubmitting(true);
    try {
      await api.resend2FA(otpSessionToken);
      setResendCountdown(60);
      setResendCount((c) => c + 1);
      setOtpError("");
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message || "Не удалось отправить код.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-ominous flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="/assets/Logo.svg"
            alt="Polka Logo"
            className="mx-auto h-20 w-20 mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground mb-2">Polka</h1>
          <p className="text-muted-foreground">Зона ограниченного доступа</p>
        </div>

        <Card className="bg-card/90 backdrop-blur border-brown-light/30 shadow-ominous">
          <CardHeader>
            <CardTitle className="text-center">
              {showOtpStep ? "Введите код из письма" : "Безопасный доступ"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showOtpStep ? (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Мы отправили 6-значный код на{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
                <div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value); setOtpError(""); }}
                    className="bg-background/50 border-brown-light/30 focus:border-brown-light text-center text-xl tracking-widest"
                  />
                  {otpError && (
                    <p className="text-sm text-red-500 mt-1 text-center">{otpError}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="ominous"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting || otpCode.length !== 6}
                >
                  {isSubmitting ? "Проверка..." : "Подтвердить"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleResendOtp}
                  disabled={isSubmitting || resendCountdown > 0 || resendCount >= 3}
                >
                  {resendCountdown > 0
                    ? `Отправить повторно (${resendCountdown}с)`
                    : resendCount >= 3
                    ? "Лимит отправок исчерпан"
                    : "Отправить повторно"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setShowOtpStep(false); setOtpCode(""); setOtpError(""); }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                  >
                    ← Вернуться к входу
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
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
            )}

            {!showOtpStep && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/portal/forgot-password")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Забыли код доступа?
                </button>
              </div>
            )}
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
