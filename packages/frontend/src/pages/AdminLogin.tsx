import { useState, useEffect, useRef } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminLogin = () => {
  const { login, verifyOtp, resendOtp, loading, otpPending } = useAdminAuth();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpPending) {
      otpInputRef.current?.focus();
    }
  }, [otpPending]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp(otpCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код");
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg(null);
    setError(null);
    try {
      const remaining = await resendOtp();
      setResendMsg(`Код отправлен повторно (осталось: ${remaining})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка повторной отправки");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm bg-card rounded-xl border border-border/30 p-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground text-center">Админ</h1>

        {!otpPending ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Почта</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Вход..." : "Войти"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Код подтверждения отправлен на вашу почту
            </p>

            <div className="space-y-2">
              <Label htmlFor="otp">Код подтверждения</Label>
              <Input
                ref={otpInputRef}
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-[0.3em]"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {resendMsg && <p className="text-sm text-green-500">{resendMsg}</p>}

            <Button type="submit" disabled={loading || otpCode.length !== 6} className="w-full">
              {loading ? "Проверка..." : "Подтвердить"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={resending}
              onClick={handleResend}
              className="w-full text-muted-foreground"
            >
              {resending ? "Отправка..." : "Отправить код повторно"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
