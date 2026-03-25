import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import * as api from "@/services/api";
import {
  BrandResponse,
  BrandProfileUpdateRequest,
  parsePydanticErrors,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

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

const profileSchema = z
  .object({
    name: z.string().min(1, "Обязательное поле").max(100),
    email: z
      .string()
      .min(1, "Обязательное поле")
      .email("Неверный формат email"),
    description: z.string().min(1, "Обязательное поле").max(1000),
    return_policy: z.string().min(1, "Обязательное поле"),
    shipping_price: z
      .number({
        required_error: "Обязательное поле",
        invalid_type_error: "Введите число",
      })
      .min(0, "Не может быть отрицательной"),
    min_free_shipping: z
      .number({ invalid_type_error: "Введите число" })
      .min(0)
      .optional(),
    shipping_provider: z.string().min(1, "Обязательное поле").max(100),
    delivery_time_min: z
      .number({ required_error: "Обязательное поле" })
      .int()
      .min(1, "Обязательное поле"),
    delivery_time_max: z
      .number({ required_error: "Обязательное поле" })
      .int()
      .min(1, "Обязательное поле"),
  })
  .refine((d) => d.delivery_time_max >= d.delivery_time_min, {
    message: "Максимальный срок должен быть не меньше минимального",
    path: ["delivery_time_max"],
  });

export function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { token } = useAuth();

  const [profile, setProfile] = useState<BrandResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setIsLoading(false);
        toast.error(
          "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
        );
        return;
      }

      try {
        setIsLoading(true);
        const fetchedProfile = await api.getBrandProfile(token);
        setProfile(fetchedProfile);
      } catch (error: unknown) {
        console.error("Failed to fetch brand profile:", error);
        const err = error as { message?: string };
        toast.error(err.message || "Не удалось загрузить профиль.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    if (id === "shipping_price" || id === "min_free_shipping") {
      setProfile((prev) =>
        prev
          ? { ...prev, [id]: value === "" ? undefined : parseFloat(value) }
          : null,
      );
    } else {
      setProfile((prev) => (prev ? { ...prev, [id]: value } : null));
    }
    if (fieldErrors[id]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!token) {
      toast.error(
        "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
      );
      return;
    }

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
        parseResult.error.flatten().fieldErrors,
      )) {
        if (msgs && msgs.length > 0) errors[field] = msgs[0];
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
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
      };
      const response = await api.updateBrandProfile(updatedProfile, token);
      setProfile(response);
      setIsEditing(false);
      toast.success("Профиль бренда успешно обновлен!");
    } catch (error: unknown) {
      console.error("Failed to update brand profile:", error);
      const err = error as {
        message?: string;
        fieldErrors?: Record<string, string>;
      };
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      toast.error(err.message || "Не удалось обновить профиль бренда.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Настройки</h2>

      <Card className="bg-card border-border/30 shadow-lg overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-brand/5 pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Профиль бренда</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Управление данными и настройками вашего бренда
              </p>
            </div>
            {!isEditing && !isLoading && profile && (
              <Button onClick={() => setIsEditing(true)} className="rounded-xl">
                Обновить
              </Button>
            )}
          </CardHeader>
        </div>
        <CardContent className="space-y-4 pt-6">
          {isLoading ? (
            <div className="space-y-4">
              <div>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-48" />
              </div>
              <div>
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-6 w-56" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div>
                <Skeleton className="h-4 w-36 mb-2" />
                <Skeleton className="h-6 w-40" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-64" />
              </div>
            </div>
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
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Контактный email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors.email}
                    </p>
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
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors.description}
                    </p>
                  )}
                </div>

                {/* Delivery section */}
                <div className="space-y-4 bg-accent/10 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Доставка
                    </h3>
                  </div>
                  <div>
                    <Label htmlFor="shipping_price">Цена доставки (руб.)</Label>
                    <Input
                      id="shipping_price"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={profile.shipping_price ?? ""}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Укажите 0 для бесплатной доставки
                    </p>
                    {fieldErrors.shipping_price && (
                      <p className="text-xs text-destructive mt-1">
                        {fieldErrors.shipping_price}
                      </p>
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
                      <p className="text-xs text-destructive mt-1">
                        {fieldErrors.min_free_shipping}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Срок доставки: от</Label>
                      <Select
                        value={String(profile.delivery_time_min ?? "")}
                        onValueChange={(v) =>
                          setProfile((p) =>
                            p
                              ? {
                                  ...p,
                                  delivery_time_min: v ? Number(v) : undefined,
                                }
                              : null,
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
                        <p className="text-xs text-destructive mt-1">
                          {fieldErrors.delivery_time_min}
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label>до</Label>
                      <Select
                        value={String(profile.delivery_time_max ?? "")}
                        onValueChange={(v) =>
                          setProfile((p) =>
                            p
                              ? {
                                  ...p,
                                  delivery_time_max: v ? Number(v) : undefined,
                                }
                              : null,
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
                        <p className="text-xs text-destructive mt-1">
                          {fieldErrors.delivery_time_max}
                        </p>
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
                      <p className="text-xs text-destructive mt-1">
                        {fieldErrors.shipping_provider}
                      </p>
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
                    <p className="text-xs text-destructive mt-1">
                      {fieldErrors.return_policy}
                    </p>
                  )}
                </div>

                <div className="flex justify-end items-center gap-3 pt-2 border-t border-border/30">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setFieldErrors({});
                    }}
                    disabled={isSaving}
                    className="text-muted-foreground"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-xl px-6"
                  >
                    {isSaving && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {isSaving ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {/* Basic info cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-accent/20 border border-border/20 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Название
                    </p>
                    <p className="font-medium">{profile.name}</p>
                  </div>
                  <div className="rounded-xl bg-accent/20 border border-border/20 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Контактный email
                    </p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>

                {/* Legal section */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Юридические данные
                  </h3>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 space-y-3 border border-border/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.contact_phone && (
                      <div className="rounded-lg bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Контактный телефон
                        </p>
                        <p className="font-medium">{profile.contact_phone}</p>
                      </div>
                    )}
                    {profile.inn && (
                      <div className="rounded-lg bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          ИНН
                        </p>
                        <p className="font-medium">{profile.inn}</p>
                      </div>
                    )}
                    {profile.tax_system && (
                      <div className="rounded-lg bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Система налогообложения
                        </p>
                        <p className="font-medium">{profile.tax_system}</p>
                      </div>
                    )}
                    {profile.vat_payer != null && (
                      <div className="rounded-lg bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Плательщик НДС
                        </p>
                        <p className="font-medium">{profile.vat_payer ? "Да" : "Нет"}</p>
                      </div>
                    )}
                    {profile.vat_payer && profile.vat_rate && (
                      <div className="rounded-lg bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Ставка НДС
                        </p>
                        <p className="font-medium">{profile.vat_rate}</p>
                      </div>
                    )}
                  </div>
                  {!profile.contact_phone && !profile.inn && profile.vat_payer == null && (
                    <p className="text-sm text-muted-foreground/60 italic">
                      Юридические данные заполняются администратором
                    </p>
                  )}
                </div>

                {/* Delivery section */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Доставка
                  </h3>
                </div>

                <div className="bg-accent/30 rounded-xl p-4 space-y-3 border border-border/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-card/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Цена доставки
                      </p>
                      <p className="font-medium">
                        {profile.shipping_price != null ? (
                          formatCurrency(profile.shipping_price)
                        ) : (
                          <span className="text-muted-foreground/60 italic text-sm">
                            Не указана
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Мин. для бесплатной
                      </p>
                      <p className="font-medium">
                        {profile.min_free_shipping != null ? (
                          formatCurrency(profile.min_free_shipping)
                        ) : (
                          <span className="text-muted-foreground/60 italic text-sm">
                            Не указана
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Срок доставки
                      </p>
                      <p className="font-medium">
                        {profile.delivery_time_min ||
                        profile.delivery_time_max ? (
                          <>
                            {profile.delivery_time_min
                              ? `от ${DELIVERY_TIME_OPTIONS.find((o) => o.value === profile.delivery_time_min)?.label ?? `${profile.delivery_time_min} дн.`}`
                              : ""}
                            {profile.delivery_time_max
                              ? ` до ${DELIVERY_TIME_OPTIONS.find((o) => o.value === profile.delivery_time_max)?.label ?? `${profile.delivery_time_max} дн.`}`
                              : ""}
                          </>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-sm">
                            Не указан
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Служба доставки
                      </p>
                      <p className="font-medium">
                        {profile.shipping_provider || (
                          <span className="text-muted-foreground/60 italic text-sm">
                            Не указана
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Return policy */}
                <div className="rounded-xl bg-accent/20 border border-border/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Политика возврата
                  </p>
                  <p className="font-medium">
                    {profile.return_policy || (
                      <span className="text-muted-foreground/60 italic text-sm">
                        Не указана
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="text-muted-foreground">
              Не удалось загрузить профиль.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
