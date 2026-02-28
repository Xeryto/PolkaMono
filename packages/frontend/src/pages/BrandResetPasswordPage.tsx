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
import { ArrowLeft, Check, Eye, EyeOff, Shield } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as api from "@/services/api";

const BrandResetPasswordPage = () => {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";

  useEffect(() => {
    if (!email) {
      navigate("/portal/forgot-password");
    }
  }, [email, navigate]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!code.trim()) {
      newErrors.code = "Код подтверждения обязателен";
    } else if (code.length < 4) {
      newErrors.code = "Код должен содержать минимум 4 символа";
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
    const illegalCharRegex = /[^a-zA-Z0-9#$\-_!]/;

    if (!password.trim()) {
      newErrors.password = "Новый пароль обязателен";
    } else if (password.length < 6) {
      newErrors.password = "Пароль должен содержать минимум 6 символов";
    } else if (!passwordRegex.test(password)) {
      newErrors.password = "Пароль должен содержать буквы и цифры";
    } else if (password.includes(" ")) {
      newErrors.password = "Пароль не должен содержать пробелов";
    } else if (illegalCharRegex.test(password)) {
      newErrors.password = "Пароль содержит недопустимые символы";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Подтверждение пароля обязательно";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Пароли не совпадают";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await api.brandResetPasswordWithCode(email, code.trim(), password);
      setIsSuccess(true);
    } catch (error: unknown) {
      console.error("Password reset failed:", error);
      const err = error as { message?: string; status?: number };

      let errorMessage = "Произошла ошибка при сбросе пароля.";

      if (err.status === 400) {
        if (err.message?.includes("Invalid brand email/name or code")) {
          errorMessage =
            "Неверный код подтверждения. Проверьте код и попробуйте снова.";
        } else if (err.message?.includes("Verification code has expired")) {
          errorMessage = "Код подтверждения истек. Запросите новый код.";
        } else if (
          err.message?.includes("You cannot reuse your current password")
        ) {
          errorMessage = "Вы не можете использовать текущий пароль.";
        } else if (
          err.message?.includes("You cannot reuse a previous password")
        ) {
          errorMessage = "Вы не можете использовать предыдущий пароль.";
        } else {
          errorMessage = err.message ?? errorMessage;
        }
      } else if (err.status === 0) {
        errorMessage =
          "Проблемы с подключением к интернету. Проверьте соединение и попробуйте снова.";
      }

      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    navigate("/portal");
  };

  const handleBackToForgotPassword = () => {
    navigate("/portal/forgot-password");
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
                <Check className="h-6 w-6 text-green-400" />
              </div>
              <CardTitle>Пароль успешно сброшен</CardTitle>
              <CardDescription>
                Ваш пароль был успешно изменен. Теперь вы можете войти в систему
                с новым паролем.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleBackToLogin}
                variant="default"
                size="lg"
                className="w-full"
              >
                <Shield className="mr-2 h-4 w-4" />
                Войти в систему
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <CardHeader>
            <CardTitle className="text-center">Введите новый пароль</CardTitle>
            <CardDescription className="text-center">
              Введите код подтверждения и новый пароль для {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-md">
                  {errors.general}
                </div>
              )}

              <div>
                <Input
                  type="text"
                  placeholder="Код подтверждения"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`bg-input border-border/50 focus:border-brand ${
                    errors.code ? "border-red-500" : ""
                  }`}
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-400">{errors.code}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Новый пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`bg-input border-border/50 focus:border-brand pr-10 ${
                      errors.password ? "border-red-500" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Подтвердите новый пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`bg-input border-border/50 focus:border-brand pr-10 ${
                      errors.confirmPassword ? "border-red-500" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-400">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full"
                disabled={
                  isSubmitting ||
                  !code.trim() ||
                  !password.trim() ||
                  !confirmPassword.trim()
                }
              >
                <Shield className="mr-2 h-4 w-4" />
                {isSubmitting ? "Сброс пароля..." : "Сбросить пароль"}
              </Button>
            </form>

            <div className="mt-4 text-center space-y-2">
              <button
                type="button"
                onClick={handleBackToForgotPassword}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline block"
              >
                ← Запросить новый код
              </button>
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline block"
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

export default BrandResetPasswordPage;



