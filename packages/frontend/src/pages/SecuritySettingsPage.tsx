import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import * as api from "@/services/api";
import { BrandResponse } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const illegalCharRegex = /[^a-zA-Z0-9#$\-_!]/;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Обязательное поле"),
    new_password: z
      .string()
      .min(6, "Минимум 6 символов")
      .refine((v) => !v.includes(" "), "Пароль не должен содержать пробелов")
      .refine(
        (v) => passwordRegex.test(v),
        "Пароль должен содержать буквы и цифры",
      )
      .refine(
        (v) => !illegalCharRegex.test(v),
        "Пароль содержит недопустимые символы",
      ),
    confirm_new_password: z.string().min(1, "Обязательное поле"),
  })
  .refine((d) => d.new_password === d.confirm_new_password, {
    message: "Пароли не совпадают",
    path: ["confirm_new_password"],
  });

type TwoFAState = "idle" | "pending_otp" | "disabling";

export function SecuritySettingsPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<BrandResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Section 1 — Account Status
  const [inactiveDialogOpen, setInactiveDialogOpen] = useState(false);
  const [togglingInactive, setTogglingInactive] = useState(false);

  // Section 2 — Change Password
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwLoading, setPwLoading] = useState(false);

  // Section 3 — 2FA
  const [twoFAState, setTwoFAState] = useState<TwoFAState>("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [twoFALoading, setTwoFALoading] = useState(false);

  // Section 4 — Delete Account
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch brand profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await api.getBrandProfile(token);
        setProfile(data);
      } catch (err: unknown) {
        toast.error(
          (err as { message?: string }).message ||
            "Не удалось загрузить профиль.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // --- Section 1: Inactive toggle ---
  const handleToggleInactive = async () => {
    if (!token || !profile) return;
    setTogglingInactive(true);
    try {
      const newState = !profile.is_inactive;
      await api.toggleBrandInactive(newState, token);
      setProfile((p) => (p ? { ...p, is_inactive: newState } : null));
      toast.success(newState ? "Аккаунт деактивирован." : "Аккаунт активирован.");
    } catch (err: unknown) {
      toast.error(
        (err as { message?: string }).message ||
          "Не удалось изменить статус.",
      );
    } finally {
      setTogglingInactive(false);
      setInactiveDialogOpen(false);
    }
  };

  // --- Section 2: Change Password ---
  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setPwForm((prev) => ({ ...prev, [id]: value }));
    if (pwErrors[id]) {
      setPwErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = passwordSchema.safeParse(pwForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const [field, msgs] of Object.entries(
        result.error.flatten().fieldErrors,
      )) {
        if (msgs && msgs.length > 0) errors[field] = msgs[0];
      }
      setPwErrors(errors);
      return;
    }
    if (!token) return;
    setPwErrors({});
    setPwLoading(true);
    try {
      await api.changeBrandPassword(
        pwForm.current_password,
        pwForm.new_password,
        token,
      );
      setPwForm({
        current_password: "",
        new_password: "",
        confirm_new_password: "",
      });
      toast.success("Пароль успешно изменён.");
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 400) {
        setPwErrors({ current_password: "Текущий пароль неверный" });
      } else {
        toast.error(e.message || "Не удалось изменить пароль.");
      }
    } finally {
      setPwLoading(false);
    }
  };

  // --- Section 3: 2FA ---
  const handleEnable2FA = async () => {
    if (!token) return;
    setTwoFALoading(true);
    try {
      await api.enableBrand2FA(token);
      setTwoFAState("pending_otp");
      setOtpCode("");
      setOtpError("");
      setResendCountdown(60);
      setResendCount(1);
    } catch (err: unknown) {
      toast.error(
        (err as { message?: string }).message || "Не удалось включить 2FA.",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!token) return;
    setTwoFALoading(true);
    setOtpError("");
    try {
      await api.confirmBrand2FA(otpCode, token);
      setProfile((p) => (p ? { ...p, two_factor_enabled: true } : null));
      setTwoFAState("idle");
      setOtpCode("");
      toast.success("2FA включена.");
    } catch (err: unknown) {
      setOtpError((err as { message?: string }).message || "Неверный код");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleResend2FA = async () => {
    if (!token || resendCount >= 3 || resendCountdown > 0) return;
    setTwoFALoading(true);
    try {
      await api.enableBrand2FA(token);
      setResendCountdown(60);
      setResendCount((c) => c + 1);
      setOtpError("");
    } catch (err: unknown) {
      toast.error(
        (err as { message?: string }).message || "Не удалось отправить код.",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!token) return;
    setTwoFALoading(true);
    setDisableError("");
    try {
      await api.disableBrand2FA(disablePassword, token);
      setProfile((p) => (p ? { ...p, two_factor_enabled: false } : null));
      setTwoFAState("idle");
      setDisablePassword("");
      toast.success("2FA отключена.");
    } catch (err: unknown) {
      setDisableError(
        (err as { message?: string }).message || "Неверный пароль",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  // --- Section 4: Delete Account ---
  const handleDeleteAccount = async () => {
    if (!token || !profile) return;
    if (deleteNameInput !== profile.name) return;
    setDeleteLoading(true);
    try {
      const result = await api.requestBrandDeletion(token);
      toast.success(
        `Удаление запланировано: ${result.scheduled_deletion_at}`,
      );
      logout();
      navigate("/portal");
    } catch (err: unknown) {
      toast.error(
        (err as { message?: string }).message ||
          "Не удалось удалить аккаунт.",
      );
    } finally {
      setDeleteLoading(false);
      setDeleteStep("idle");
      setDeleteNameInput("");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-36" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Безопасность</h2>

      {/* Section 1 — Account Status */}
      <Card className="bg-card border-border/30 shadow-lg overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="relative">
            <CardTitle>Статус аккаунта</CardTitle>
          </CardHeader>
        </div>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Текущий статус:{" "}
            <Badge variant={profile?.is_inactive ? "destructive" : "default"} className={!profile?.is_inactive ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : ""}>
              {profile?.is_inactive ? "Неактивный" : "Активный"}
            </Badge>
          </div>
          <Button
            variant={profile?.is_inactive ? "default" : "outline"}
            onClick={() => setInactiveDialogOpen(true)}
            disabled={togglingInactive}
          >
            {togglingInactive && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {profile?.is_inactive
              ? "Активировать аккаунт"
              : "Деактивировать аккаунт"}
          </Button>

          <AlertDialog
            open={inactiveDialogOpen}
            onOpenChange={setInactiveDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {profile?.is_inactive
                    ? "Активировать аккаунт?"
                    : "Деактивировать аккаунт?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {profile?.is_inactive
                    ? "Ваши товары снова появятся в маркетплейсе."
                    : "Ваши товары будут скрыты из маркетплейса. Продолжить?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleToggleInactive}
                  disabled={togglingInactive}
                >
                  Подтвердить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Section 2 — Change Password */}
      <Card className="bg-card border-border/30 shadow-lg overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="relative">
            <CardTitle>Изменить пароль</CardTitle>
          </CardHeader>
        </div>
        <CardContent>
          <form onSubmit={handlePwSubmit} className="space-y-4">
            <div>
              <Label htmlFor="current_password">Текущий пароль</Label>
              <Input
                id="current_password"
                type="password"
                value={pwForm.current_password}
                onChange={handlePwChange}
                className="mt-1"
              />
              {pwErrors.current_password && (
                <p className="text-sm text-red-500 mt-1">
                  {pwErrors.current_password}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="new_password">Новый пароль</Label>
              <Input
                id="new_password"
                type="password"
                value={pwForm.new_password}
                onChange={handlePwChange}
                className="mt-1"
              />
              {pwErrors.new_password && (
                <p className="text-sm text-red-500 mt-1">
                  {pwErrors.new_password}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="confirm_new_password">
                Повторите новый пароль
              </Label>
              <Input
                id="confirm_new_password"
                type="password"
                value={pwForm.confirm_new_password}
                onChange={handlePwChange}
                className="mt-1"
              />
              {pwErrors.confirm_new_password && (
                <p className="text-sm text-red-500 mt-1">
                  {pwErrors.confirm_new_password}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pwLoading}>
                {pwLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {pwLoading ? "Сохранение..." : "Изменить пароль"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Section 3 — Two-Factor Authentication */}
      <Card className="bg-card border-border/30 shadow-lg overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="relative">
            <CardTitle>Двухфакторная аутентификация</CardTitle>
          </CardHeader>
        </div>
        <CardContent className="space-y-4">
          {twoFAState === "idle" && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                Статус 2FA:{" "}
                <Badge variant={profile?.two_factor_enabled ? "default" : "secondary"} className={profile?.two_factor_enabled ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : ""}>
                  {profile?.two_factor_enabled ? "Включена" : "Отключена"}
                </Badge>
              </div>
              {profile?.two_factor_enabled ? (
                <Button
                  variant="outline"
                  onClick={() => setTwoFAState("disabling")}
                  disabled={twoFALoading}
                >
                  Отключить 2FA
                </Button>
              ) : (
                <Button onClick={handleEnable2FA} disabled={twoFALoading}>
                  {twoFALoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {twoFALoading ? "Отправка кода..." : "Включить 2FA"}
                </Button>
              )}
            </div>
          )}

          {twoFAState === "pending_otp" && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-muted-foreground">
                Введите 6-значный код из письма для подтверждения.
                {profile?.email && (
                  <>
                    {" "}
                    Код отправлен на{" "}
                    <span className="font-medium text-foreground">
                      {(() => {
                        const [local, domain] = profile.email.split("@");
                        const visible = local.slice(0, 3);
                        const masked = "*".repeat(
                          Math.max(local.length - 3, 1),
                        );
                        return `${visible}${masked}@${domain}`;
                      })()}
                    </span>
                  </>
                )}
              </p>
              <div>
                <Label htmlFor="otp_code">Код подтверждения</Label>
                <div className="mt-2">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(value) => {
                      setOtpCode(value);
                      setOtpError("");
                    }}
                  >
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
                {otpError && (
                  <p className="text-sm text-red-500 mt-1">{otpError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirm2FA}
                  disabled={twoFALoading || otpCode.length !== 6}
                >
                  {twoFALoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {twoFALoading ? "Проверка..." : "Подтвердить"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResend2FA}
                  disabled={
                    twoFALoading || resendCountdown > 0 || resendCount >= 3
                  }
                >
                  {resendCountdown > 0
                    ? `Отправить повторно (${resendCountdown}с)`
                    : resendCount >= 3
                      ? "Лимит отправок исчерпан"
                      : "Отправить повторно"}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTwoFAState("idle")}
              >
                Отмена
              </Button>
            </div>
          )}

          {twoFAState === "disabling" && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-muted-foreground">
                Введите ваш пароль для отключения 2FA.
              </p>
              <div>
                <Label htmlFor="disable_2fa_password">Пароль</Label>
                <Input
                  id="disable_2fa_password"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => {
                    setDisablePassword(e.target.value);
                    setDisableError("");
                  }}
                  className="mt-1"
                />
                {disableError && (
                  <p className="text-sm text-red-500 mt-1">{disableError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDisable2FA}
                  disabled={twoFALoading || !disablePassword}
                >
                  {twoFALoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {twoFALoading ? "Отключение..." : "Подтвердить отключение"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTwoFAState("idle");
                    setDisablePassword("");
                    setDisableError("");
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — Delete Account */}
      <Card className="bg-card border-destructive/30 shadow-lg overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-destructive/5 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="relative">
            <CardTitle className="text-destructive">Удаление аккаунта</CardTitle>
          </CardHeader>
        </div>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Это действие нельзя отменить немедленно. У вас есть 30 дней для
            восстановления.
          </p>
          <Button
            variant="destructive"
            onClick={() => setDeleteStep("confirm")}
            disabled={deleteLoading}
          >
            Удалить аккаунт
          </Button>

          <AlertDialog
            open={deleteStep === "confirm"}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteStep("idle");
                setDeleteNameInput("");
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Вы уверены, что хотите удалить аккаунт?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Ваши заказы сохранятся (историческая запись)</li>
                      <li>Ваши товары будут скрыты из маркетплейса</li>
                      <li>
                        Персональные данные будут удалены в соответствии с
                        законодательством РФ
                      </li>
                      <li>
                        У вас есть 30 дней для восстановления аккаунта (просто
                        войдите снова)
                      </li>
                    </ul>
                    <div className="mt-4">
                      <p className="mb-1">
                        Введите название вашего бренда для подтверждения:{" "}
                        <span className="font-semibold text-foreground">
                          {profile?.name}
                        </span>
                      </p>
                      <Input
                        value={deleteNameInput}
                        onChange={(e) => setDeleteNameInput(e.target.value)}
                        placeholder={profile?.name}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteNameInput("")}>
                  Отмена
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteNameInput !== profile?.name}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {deleteLoading ? "Удаление..." : "Удалить аккаунт"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
