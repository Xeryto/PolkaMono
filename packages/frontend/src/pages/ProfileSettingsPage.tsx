import React, { useState, useEffect, useRef } from "react";
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
import { BrandResponse, BrandProfileUpdateRequest } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { token } = useAuth(); // Get token from useAuth

  const [profile, setProfile] = useState<BrandResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const wasPayoutLockedOnLoad = useRef<boolean | null>(null);

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
        wasPayoutLockedOnLoad.current = fetchedProfile.payout_account_locked ?? false;
      } catch (error: any) {
        console.error("Failed to fetch brand profile:", error);
        toast({
          title: "Error",
          description: error.message || "Не удалось загрузить профиль.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [token, toast]); // Add token and toast to dependency array

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    if (id === "shipping_price" || id === "min_free_shipping") {
      setProfile((prev) =>
        prev ? { ...prev, [id]: parseFloat(value) } : null
      );
    } else {
      setProfile((prev) => (prev ? { ...prev, [id]: value } : null));
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

    const hasRequisites = [profile.inn, profile.registration_address, profile.payout_account].some(
      (v) => (v ?? "").toString().trim() !== ""
    );
    const alreadyLocked = wasPayoutLockedOnLoad.current === true;
    if (!alreadyLocked && hasRequisites && !profile.payout_account_locked) {
      toast({
        title: "Подтвердите сохранение реквизитов",
        description:
          "Вы заполнили ИНН, адрес или счёт для выплат. Отметьте галочку «Подтверждаю сохранение реквизитов» — после сохранения они будут заблокированы. Иначе реквизиты не будут сохранены.",
        variant: "destructive",
      });
      return;
    }

    const required = [
      { v: profile.name?.trim(), label: "Название" },
      { v: profile.email?.trim(), label: "Контактный Email" },
      { v: profile.shipping_provider?.trim(), label: "Фирма доставки" },
      { v: profile.return_policy?.trim(), label: "Политика возврата" },
    ];
    const missing = required.filter((r) => !r.v);
    if (missing.length > 0) {
      toast({
        title: "Заполните обязательные поля",
        description: missing.map((m) => m.label).join(", "),
        variant: "destructive",
      });
      return;
    }
    const shipPrice = profile.shipping_price;
    if (shipPrice != null && (typeof shipPrice !== "number" || shipPrice < 0)) {
      toast({
        title: "Ошибка",
        description: "Цена доставки не может быть отрицательной.",
        variant: "destructive",
      });
      return;
    }
    const minFree = profile.min_free_shipping;
    if (minFree != null && (typeof minFree !== "number" || minFree < 0)) {
      toast({
        title: "Ошибка",
        description: "Минимальная цена для бесплатной доставки не может быть отрицательной.",
        variant: "destructive",
      });
      return;
    }

    const sendingRequisites = !alreadyLocked && !!profile.payout_account_locked;
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
        inn: sendingRequisites ? profile.inn : undefined,
        registration_address: sendingRequisites ? profile.registration_address : undefined,
        payout_account: sendingRequisites ? profile.payout_account : undefined,
        payout_account_locked: sendingRequisites ? true : undefined,
      };
      const response = await api.updateBrandProfile(updatedProfile, token);
      setProfile(response);
      setIsEditing(false);
      toast({
        title: "Успех",
        description: "Профиль бренда успешно обновлен!",
      });
    } catch (error: any) {
      console.error("Failed to update brand profile:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить профиль бренда.",
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
                </div>
                <div>
                  <Label htmlFor="inn" className="text-sm font-medium text-muted-foreground">
                    ИНН
                  </Label>
                  <Input
                    id="inn"
                    value={profile.inn ?? ""}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="10 или 12 цифр"
                  />
                </div>
                <div>
                  <Label htmlFor="registration_address" className="text-sm font-medium text-muted-foreground">
                    Адрес регистрации
                  </Label>
                  <Textarea
                    id="registration_address"
                    value={profile.registration_address ?? ""}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Юридический адрес"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="payout_account" className="text-sm font-medium text-muted-foreground">
                    Счёт, на который мы будем производить выплату
                  </Label>
                  <Input
                    id="payout_account"
                    value={profile.payout_account ?? ""}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Номер счёта (реквизиты)"
                    disabled={profile.payout_account_locked}
                  />
                  {profile.payout_account_locked && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Счёт заблокирован. Изменения только через поддержку.
                    </p>
                  )}
                  {!profile.payout_account_locked && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="payout_account_locked"
                        checked={profile.payout_account_locked}
                        onCheckedChange={(checked) =>
                          setProfile((prev) =>
                            prev ? { ...prev, payout_account_locked: !!checked } : null
                          )
                        }
                      />
                      <Label
                        htmlFor="payout_account_locked"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Подтверждаю сохранение реквизитов (ИНН, адрес, счёт). После сохранения они будут заблокированы.
                      </Label>
                    </div>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="min_free_shipping"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Минимальная цена для бесплатной доставки
                  </label>
                  <Input
                    id="min_free_shipping"
                    type="number"
                    value={profile.min_free_shipping}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor="shipping_price"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Цена доставки
                  </label>
                  <Input
                    id="shipping_price"
                    type="number"
                    value={profile.shipping_price}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor="shipping_provider"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Фирма доставки
                  </label>
                  <Input
                    id="shipping_provider"
                    value={profile.shipping_provider}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
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
                    value={profile.return_policy}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
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
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    ИНН
                  </p>
                  <p className="text-lg">{profile.inn || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Адрес регистрации
                  </p>
                  <p className="text-lg">{profile.registration_address || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Счёт для выплат
                  </p>
                  <p className="text-lg flex items-center gap-2">
                    {profile.payout_account || "—"}
                    {profile.payout_account_locked && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> заблокирован
                      </span>
                    )}
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
                    Фирма доставки
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
    </div>
  );
}
