import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import * as api from "@/services/api";
import { BrandLoginRequest } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const Portal = () => {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otpSessionToken, setOtpSessionToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  const { login } = useAuth();
  const navigate = useNavigate();

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
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUser", JSON.stringify(user));
    navigate("/dashboard");
    window.location.href = "/dashboard";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Пожалуйста, введите email бренда."); return; }
    if (!password.trim()) { toast.error("Пожалуйста, введите пароль."); return; }

    setIsSubmitting(true);
    try {
      const credentials: BrandLoginRequest = { email: email.trim(), password };
      const response = await api.brandLogin(credentials);
      const resp = response as { otp_required?: boolean; session_token?: string };
      if (resp.otp_required) {
        setOtpSessionToken(resp.session_token ?? "");
        setShowOtpStep(true);
        setResendCountdown(60);
        setResendCount(1);
        return;
      }
      await login(credentials);
      navigate("/dashboard");
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      let msg = "Произошла ошибка при входе в систему.";
      if (err.status === 401) msg = "Неверные учетные данные. Проверьте email и пароль.";
      else if (err.status === 0) msg = "Проблемы с подключением. Проверьте соединение.";
      else if (err.message) msg = err.message;
      toast.error(msg);
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
    } catch (error: unknown) {
      setOtpError((error as { message?: string }).message || "Неверный код");
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
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message || "Не удалось отправить код.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/assets/Logo.svg" alt="Polka Logo" className="mx-auto h-20 w-20 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Polka</h1>
          <p className="text-muted-foreground">Портал для брендов</p>
        </div>

        <Card className="bg-card/90 backdrop-blur border-border/30 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-center">
              {showOtpStep ? "Введите код из письма" : "Вход в аккаунт"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Animated slide between steps */}
            <div className="relative">
              <div
                className={`transition-all duration-300 ease-out ${
                  showOtpStep
                    ? "opacity-0 -translate-x-4 absolute inset-0 pointer-events-none"
                    : "opacity-100 translate-x-0"
                }`}
              >
                <form onSubmit={handleLogin} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-input border-border/50 focus:border-brand"
                  />
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-input border-border/50 focus:border-brand pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting || !email.trim() || !password.trim()}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting ? "Вход..." : "Войти"}
                  </Button>
                </form>
              </div>

              <div
                className={`transition-all duration-300 ease-out ${
                  showOtpStep
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 absolute inset-0 pointer-events-none"
                }`}
              >
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Мы отправили 6-значный код на{" "}
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otpCode} onChange={(value) => { setOtpCode(value); setOtpError(""); }}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || otpCode.length !== 6}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
              </div>
            </div>

            {!showOtpStep && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/portal/forgot-password")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Забыли пароль?
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Вернуться на главный сайт
          </a>
        </div>
      </div>
    </div>
  );
};

export default Portal;
