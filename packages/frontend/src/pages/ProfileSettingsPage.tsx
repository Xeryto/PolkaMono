import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api";
import { BrandResponse, BrandProfileUpdateRequest, parsePydanticErrors } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

const DELIVERY_TIME_OPTIONS = [
  { value: 1, label: "1 день" },
  { value: 3, label: "3 дня" },
  { value: 5, label: "5 дней" },
  { value: 7, label: "1 неделя" },
  { value: 14, label: "2 недели" },
  { value: 21, label: "3 недели" },
  { value: 30, label: "1 месяц" },
  { value: 60, label: "2 месяца" },
  { value: 90, label: "3 месяца" },
];

const profileSchema = z.object({
  name: z.string().min(1, "Обязательное поле").max(100),
  email: z.string().min(1, "Обязательное поле").email("Неверный формат email"),
  description: z.string().min(1, "Обязательное поле").max(1000),
  return_policy: z.string().min(1, "Обязательное поле"),
  shipping_price: z
    .number({ required_error: "Обязательное поле", invalid_type_error: "Введите число" })
    .min(0, "Не может быть отрицательной"),
  min_free_shipping: z.number({ invalid_type_error: "Введите число" }).min(0).optional(),
  shipping_provider: z.string().min(1, "Обязательное поле").max(100),
  delivery_time_min: z.number({ required_error: "Обязательное поле" }).int().min(1, "Обязательное поле"),
  delivery_time_max: z.number({ required_error: "Обязательное поле" }).int().min(1, "Обязательное поле"),
}).refine(
  (d) => d.delivery_time_max >= d.delivery_time_min,
  { message: "Максимальный срок должен быть не меньше минимального", path: ["delivery_time_max"] }
);

export function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { token } = useAuth();

  const [profile, setProfile] = useState<BrandResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setIsLoading(false);
        toast({
          title: "Error",
          description:
            "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        const fetchedProfile = await api.getBrandProfile(token);
        setProfile(fetchedProfile);
      } catch (error: unknown) {
        console.error("Failed to fetch brand profile:", error);
        const err = error as { message?: string };
        toast({
          title: "Error",
          description: err.message || "Не удалось загрузить профиль.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [token, toast]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    if (id === "shipping_price" || id === "min_free_shipping") {
      setProfile((prev) =>
        prev ? { ...prev, [id]: value === "" ? undefined : parseFloat(value) } : null
      );
    } else {
      setProfile((prev) => (prev ? { ...prev, [id]: value } : null));
    }
    // Clear field error on change
    if (fieldErrors[id]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!token) {
      toast({
        title: "Ошибка",
        description: "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
        variant: "destructive",
      });
      return;
    }

    // Zod validation
    const parseResult = profileSchema.safeParse({
      name: profile.name,
      email: profile.email,
      description: profile.description,
      return_policy: profile.return_policy,
      shipping_price: profile.shipping_price,
      min_free_shipping: profile.min_free_shipping,
      shipping_provider: profile.shipping_provider,
      delivery_time_min: profile.delivery_time_min,
      delivery_time_max: profile.delivery_time_max,
    });

    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      for (const [field, msgs] of Object.entries(
        parseResult.error.flatten().fieldErrors
      )) {
        if (msgs && msgs.length > 0) errors[field] = msgs[0];
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);
    try {
      const updatedProfile: BrandProfileUpdateRequest = {
        name: profile.name,
        email: profile.email,
        slug: profile.slug,
        logo: profile.logo,
        description: profile.description,
        return_policy: profile.return_policy,
        min_free_shipping: profile.min_free_shipping,
        shipping_price: profile.shipping_price,
        shipping_provider: profile.shipping_provider,
        delivery_time_min: profile.delivery_time_min,
        delivery_time_max: profile.delivery_time_max,
        // inn, registration_address, payout_account, payout_account_locked intentionally omitted (admin-only)
      };
      const response = await api.updateBrandProfile(updatedProfile, token);
      setProfile(response);
      setIsEditing(false);
      toast({
        title: "Успех",
        description: "Профиль бренда успешно обновлен!",
      });
    } catch (error: unknown) {
      console.error("Failed to update brand profile:", error);
      const err = error as { message?: string; fieldErrors?: Record<string, string> };
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось обновить профиль бренда.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Настройки</h2>

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Профиль бренда</CardTitle>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>Обновить</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div>Загрузка профиля...</div>
          ) : profile ? (
            isEditing ? (
              <>
                <div>
                  <label
                    htmlFor="name"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Название
                  </label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Контактный Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Описание
                  </label>
                  <Textarea
                    id="description"
                    value={profile.description ?? ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                  {fieldErrors.description && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.description}</p>
                  )}
                </div>

                {/* Legal info — view-only modal trigger */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Юридические данные</h3>
                  <Button variant="outline" size="sm" onClick={() => setLegalModalOpen(true)}>
                    Просмотреть реквизиты
                  </Button>
                </div>

                {/* Delivery section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Доставка</h3>
                  <div>
                    <Label htmlFor="shipping_price">Цена доставки (руб.)</Label>
                    <Input
                      id="shipping_price"
                      type="number"
                      min={0}
                      value={profile.shipping_price ?? ""}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    {fieldErrors.shipping_price && (
                      <p className="text-xs text-destructive mt-1">{fieldErrors.shipping_price}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="min_free_shipping">
                      Мин. сумма для бесплатной доставки (необязательно)
                    </Label>
                    <Input
                      id="min_free_shipping"
                      type="number"
                      min={0}
                      value={profile.min_free_shipping ?? ""}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    {fieldErrors.min_free_shipping && (
                      <p className="text-xs text-destructive mt-1">{fieldErrors.min_free_shipping}</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Срок доставки: от</Label>
                      <Select
                        value={String(profile.delivery_time_min ?? "")}
                        onValueChange={(v) =>
                          setProfile((p) =>
                            p ? { ...p, delivery_time_min: v ? Number(v) : undefined } : null
                          )
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TIME_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={String(o.value)}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.delivery_time_min && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.delivery_time_min}</p>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label>до</Label>
                      <Select
                        value={String(profile.delivery_time_max ?? "")}
                        onValueChange={(v) =>
                          setProfile((p) =>
                            p ? { ...p, delivery_time_max: v ? Number(v) : undefined } : null
                          )
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TIME_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={String(o.value)}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.delivery_time_max && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.delivery_time_max}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="shipping_provider">Служба доставки</Label>
                    <Input
                      id="shipping_provider"
                      value={profile.shipping_provider ?? ""}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    {fieldErrors.shipping_provider && (
                      <p className="text-xs text-destructive mt-1">{fieldErrors.shipping_provider}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="return_policy"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Политика возврата
                  </label>
                  <Textarea
                    id="return_policy"
                    value={profile.return_policy ?? ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                  {fieldErrors.return_policy && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.return_policy}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setIsEditing(false); setFieldErrors({}); }}
                    disabled={isLoading}
                  >
                    Отмена
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Название
                  </p>
                  <p className="text-lg">{profile.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Контактный Email
                  </p>
                  <p className="text-lg">{profile.email}</p>
                </div>

                {/* Legal info — view-only modal trigger (also in view mode) */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Юридические данные</h3>
                  <Button variant="outline" size="sm" onClick={() => setLegalModalOpen(true)}>
                    Просмотреть реквизиты
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Цена доставки
                  </p>
                  <p className="text-lg">
                    {formatCurrency(profile.shipping_price)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Минимальная цена для бесплатной доставки
                  </p>
                  <p className="text-lg">
                    {formatCurrency(profile.min_free_shipping)}
                  </p>
                </div>
                {(profile.delivery_time_min || profile.delivery_time_max) && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Срок доставки
                    </p>
                    <p className="text-lg">
                      {profile.delivery_time_min
                        ? `от ${DELIVERY_TIME_OPTIONS.find((o) => o.value === profile.delivery_time_min)?.label ?? `${profile.delivery_time_min} дн.`}`
                        : ""}
                      {profile.delivery_time_max
                        ? ` до ${DELIVERY_TIME_OPTIONS.find((o) => o.value === profile.delivery_time_max)?.label ?? `${profile.delivery_time_max} дн.`}`
                        : ""}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Служба доставки
                  </p>
                  <p className="text-lg">{profile.shipping_provider}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Политика возврата
                  </p>
                  <p className="text-lg">{profile.return_policy}</p>
                </div>
              </div>
            )
          ) : (
            <div>Нет удалось загрузить профиль.</div>
          )}
        </CardContent>
      </Card>

      {/* Legal info Dialog (read-only) */}
      <Dialog open={legalModalOpen} onOpenChange={setLegalModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Юридические данные и выплаты</DialogTitle>
            <DialogDescription>
              Эти данные доступны только для просмотра. Для изменений обратитесь в поддержку.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">ИНН</p>
              <p className="font-medium">{profile?.inn || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Адрес регистрации</p>
              <p className="font-medium">{profile?.registration_address || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Счёт для выплат</p>
              <p className="font-medium">{profile?.payout_account || "—"}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
