import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAdminBrands,
  getAdminBrand,
  createAdminBrand,
  updateAdminBrand,
  activateAdminBrand,
  deactivateAdminBrand,
  type AdminBrandListItem,
  type AdminBrandDetailResponse,
  type AdminBrandCreatePayload,
  type AdminBrandCreateResponse,
  type AdminBrandUpdatePayload,
} from "@/services/adminApi";
import { Copy, Pencil } from "lucide-react";

const TAX_SYSTEMS = ["ОСНО", "УСН", "АУСН", "ПСН"];
const VAT_RATES = ["5%", "7%", "22%"];

interface EditState {
  brand: AdminBrandListItem;
  detail: AdminBrandDetailResponse | null;
  loading: boolean;
  // fields
  name: string;
  email: string;
  contact_phone: string;
  inn: string;
  kpp: string;
  ogrn: string;
  registration_address: string;
  payout_account: string;
  tax_system: string;
  vat_payer: boolean | null;
  vat_rate: string;
}

export function AdminBrandsView() {
  const [brands, setBrands] = useState<AdminBrandListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newInn, setNewInn] = useState("");
  const [newKpp, setNewKpp] = useState("");
  const [newOgrn, setNewOgrn] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPayout, setNewPayout] = useState("");
  const [newTaxSystem, setNewTaxSystem] = useState("");
  const [newVatPayer, setNewVatPayer] = useState(false);
  const [newVatRate, setNewVatRate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminBrandCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit dialog
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Toggle errors
  const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({});

  const fetchBrands = useCallback(async () => {
    try {
      setBrands(await getAdminBrands());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPhone.trim() || !newInn.trim() ||
        !newOgrn.trim() || !newAddress.trim() || !newPayout.trim() || !newTaxSystem) return;
    setCreating(true);
    setCreateError(null);
    setCreated(null);
    try {
      const payload: AdminBrandCreatePayload = {
        name: newName.trim(),
        email: newEmail.trim(),
        contact_phone: newPhone.trim(),
        inn: newInn.trim(),
        kpp: newKpp.trim() || undefined,
        ogrn: newOgrn.trim(),
        registration_address: newAddress.trim(),
        payout_account: newPayout.trim(),
        tax_system: newTaxSystem,
        vat_payer: newVatPayer,
        vat_rate: newVatPayer && newVatRate ? newVatRate : undefined,
      };
      const res = await createAdminBrand(payload);
      setCreated(res);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewInn(""); setNewKpp("");
      setNewOgrn(""); setNewAddress(""); setNewPayout(""); setNewTaxSystem("");
      setNewVatPayer(false); setNewVatRate("");
      fetchBrands();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (!created) return;
    navigator.clipboard.writeText(
      `Email: ${created.email}\nПароль: ${created.temporary_password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async (brand: AdminBrandListItem) => {
    setToggleErrors((prev) => ({ ...prev, [brand.id]: "" }));
    try {
      if (brand.is_inactive) {
        await activateAdminBrand(brand.id);
      } else {
        await deactivateAdminBrand(brand.id);
      }
      fetchBrands();
    } catch (e: unknown) {
      setToggleErrors((prev) => ({
        ...prev,
        [brand.id]: e instanceof Error ? e.message : "Ошибка",
      }));
    }
  };

  const openEdit = async (brand: AdminBrandListItem) => {
    const base: EditState = {
      brand,
      detail: null,
      loading: true,
      name: brand.name,
      email: brand.email,
      contact_phone: "",
      inn: "",
      kpp: "",
      ogrn: "",
      registration_address: "",
      payout_account: "",
      tax_system: "",
      vat_payer: null,
      vat_rate: "",
    };
    setEdit(base);
    setEditError(null);
    try {
      const detail = await getAdminBrand(brand.id);
      setEdit({
        ...base,
        detail,
        loading: false,
        contact_phone: detail.contact_phone ?? "",
        inn: detail.inn ?? "",
        kpp: detail.kpp ?? "",
        ogrn: detail.ogrn ?? "",
        registration_address: detail.registration_address ?? "",
        payout_account: detail.payout_account ?? "",
        tax_system: detail.tax_system ?? "",
        vat_payer: detail.vat_payer ?? null,
        vat_rate: detail.vat_rate ?? "",
      });
    } catch {
      setEdit((prev) => prev ? { ...prev, loading: false } : null);
    }
  };

  const handleEditSave = async () => {
    if (!edit) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const d = edit.detail;
      const updates: AdminBrandUpdatePayload = {};
      if (edit.name.trim() !== edit.brand.name) updates.name = edit.name.trim();
      if (edit.email.trim() !== edit.brand.email) updates.email = edit.email.trim();
      if (edit.contact_phone.trim() !== (d?.contact_phone ?? "")) updates.contact_phone = edit.contact_phone.trim() || undefined;
      if (edit.inn.trim() !== (d?.inn ?? "")) updates.inn = edit.inn.trim() || undefined;
      if (edit.kpp.trim() !== (d?.kpp ?? "")) updates.kpp = edit.kpp.trim() || undefined;
      if (edit.ogrn.trim() !== (d?.ogrn ?? "")) updates.ogrn = edit.ogrn.trim() || undefined;
      if (edit.registration_address.trim() !== (d?.registration_address ?? "")) updates.registration_address = edit.registration_address.trim() || undefined;
      if (edit.payout_account.trim() !== (d?.payout_account ?? "")) updates.payout_account = edit.payout_account.trim() || undefined;
      if (edit.tax_system !== (d?.tax_system ?? "")) updates.tax_system = edit.tax_system || undefined;
      if (edit.vat_payer !== (d?.vat_payer ?? null)) updates.vat_payer = edit.vat_payer ?? undefined;
      if (edit.vat_rate !== (d?.vat_rate ?? "")) updates.vat_rate = edit.vat_rate || undefined;

      if (Object.keys(updates).length === 0) {
        setEdit(null);
        return;
      }
      await updateAdminBrand(edit.brand.id, updates);
      setEdit(null);
      fetchBrands();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Ошибка обновления");
    } finally {
      setEditSaving(false);
    }
  };

  const setEditField = <K extends keyof EditState>(key: K, value: EditState[K]) => {
    setEdit((prev) => prev ? { ...prev, [key]: value } : null);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-foreground">Бренды</h2>

      {/* Create brand */}
      <div className="bg-card rounded-xl border border-border/30 p-5 space-y-4 max-w-lg">
        <h3 className="text-sm font-medium text-foreground">Создать бренд</h3>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Основное</h4>
          <div className="space-y-2">
            <Label htmlFor="brand-name">Название</Label>
            <Input id="brand-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название бренда" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-email">Email</Label>
            <Input id="brand-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="brand@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-phone">Контактный телефон</Label>
            <Input id="brand-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+7..." />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Юридические данные</h4>
          <div className="space-y-2">
            <Label htmlFor="brand-inn">ИНН</Label>
            <Input id="brand-inn" value={newInn} onChange={(e) => setNewInn(e.target.value)} placeholder="10 или 12 цифр" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-kpp">КПП <span className="text-muted-foreground text-xs">(необязательно, только для ЮЛ)</span></Label>
            <Input id="brand-kpp" value={newKpp} onChange={(e) => setNewKpp(e.target.value)} placeholder="9 цифр" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-ogrn">ОГРН / ОГРНИП</Label>
            <Input id="brand-ogrn" value={newOgrn} onChange={(e) => setNewOgrn(e.target.value)} placeholder="13 или 15 цифр" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-address">Адрес регистрации</Label>
            <Input id="brand-address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-payout">Расчётный счёт</Label>
            <Input id="brand-payout" value={newPayout} onChange={(e) => setNewPayout(e.target.value)} placeholder="20 цифр" />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Налогообложение</h4>
          <div className="space-y-2">
            <Label>Система налогообложения</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newTaxSystem}
              onChange={(e) => setNewTaxSystem(e.target.value)}
            >
              <option value="">— выберите —</option>
              {TAX_SYSTEMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="new-vat-payer" checked={newVatPayer} onChange={(e) => { setNewVatPayer(e.target.checked); if (!e.target.checked) setNewVatRate(""); }} className="h-4 w-4" />
            <Label htmlFor="new-vat-payer">Плательщик НДС</Label>
          </div>
          {newVatPayer && (
            <div className="space-y-2">
              <Label>Ставка НДС</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newVatRate}
                onChange={(e) => setNewVatRate(e.target.value)}
              >
                <option value="">— выберите —</option>
                {VAT_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>

        <Button
          onClick={handleCreate}
          disabled={creating || !newName.trim() || !newEmail.trim() || !newPhone.trim() ||
            !newInn.trim() || !newOgrn.trim() || !newAddress.trim() || !newPayout.trim() ||
            !newTaxSystem || (newVatPayer && !newVatRate)}
          size="sm"
        >
          {creating ? "Создание..." : "Создать"}
        </Button>
        {createError && <p className="text-sm text-destructive">{createError}</p>}
        {created && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 border border-border/30">
            <p className="text-sm text-foreground">
              <strong>Email:</strong> {created.email}
            </p>
            <p className="text-sm text-foreground">
              <strong>Пароль:</strong> {created.temporary_password}
            </p>
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Скопировано" : "Копировать"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Данные для входа отправлены на email бренда
            </p>
          </div>
        )}
      </div>

      {/* Brand list */}
      <div className="bg-card rounded-xl border border-border/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Загрузка...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Нет брендов
                </td>
              </tr>
            ) : (
              brands.map((b) => (
                <tr key={b.id} className="border-b border-border/10">
                  <td className="px-4 py-3 text-foreground">{b.name}</td>
                  <td className="px-4 py-3 text-foreground">{b.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.is_inactive ? "secondary" : "default"}>
                      {b.is_inactive ? "Неактивен" : "Активен"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(b)}
                        >
                          {b.is_inactive ? "Активировать" : "Деактивировать"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {toggleErrors[b.id] && (
                        <p className="text-xs text-destructive max-w-xs">{toggleErrors[b.id]}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать бренд</DialogTitle>
          </DialogHeader>
          {edit?.loading ? (
            <p className="text-sm text-muted-foreground py-4">Загрузка...</p>
          ) : (
            <div className="space-y-6">
              {/* Basic */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Основное</h4>
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input value={edit?.name ?? ""} onChange={(e) => setEditField("name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={edit?.email ?? ""} onChange={(e) => setEditField("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Контактный телефон</Label>
                  <Input value={edit?.contact_phone ?? ""} onChange={(e) => setEditField("contact_phone", e.target.value)} placeholder="+7..." />
                </div>
              </div>

              {/* Legal */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Юридические данные</h4>
                <div className="space-y-2">
                  <Label>ИНН</Label>
                  <Input value={edit?.inn ?? ""} onChange={(e) => setEditField("inn", e.target.value)} placeholder="10 или 12 цифр" />
                </div>
                <div className="space-y-2">
                  <Label>КПП <span className="text-muted-foreground text-xs">(необязательно, только для ЮЛ)</span></Label>
                  <Input value={edit?.kpp ?? ""} onChange={(e) => setEditField("kpp", e.target.value)} placeholder="9 цифр" />
                </div>
                <div className="space-y-2">
                  <Label>ОГРН / ОГРНИП</Label>
                  <Input value={edit?.ogrn ?? ""} onChange={(e) => setEditField("ogrn", e.target.value)} placeholder="13 или 15 цифр" />
                </div>
                <div className="space-y-2">
                  <Label>Адрес регистрации</Label>
                  <Input value={edit?.registration_address ?? ""} onChange={(e) => setEditField("registration_address", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Расчётный счёт</Label>
                  <Input value={edit?.payout_account ?? ""} onChange={(e) => setEditField("payout_account", e.target.value)} placeholder="20 цифр" />
                </div>
              </div>

              {/* Tax */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Налогообложение</h4>
                <div className="space-y-2">
                  <Label>Система налогообложения</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={edit?.tax_system ?? ""}
                    onChange={(e) => setEditField("tax_system", e.target.value)}
                  >
                    <option value="">— выберите —</option>
                    {TAX_SYSTEMS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="vat-payer"
                    checked={edit?.vat_payer === true}
                    onChange={(e) => setEditField("vat_payer", e.target.checked ? true : false)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="vat-payer">Плательщик НДС</Label>
                </div>
                {edit?.vat_payer && (
                  <div className="space-y-2">
                    <Label>Ставка НДС</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={edit?.vat_rate ?? ""}
                      onChange={(e) => setEditField("vat_rate", e.target.value)}
                    >
                      <option value="">— выберите —</option>
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Отмена
                </Button>
                <Button onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
