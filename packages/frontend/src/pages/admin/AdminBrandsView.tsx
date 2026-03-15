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
  createAdminBrand,
  updateAdminBrand,
  activateAdminBrand,
  deactivateAdminBrand,
  type AdminBrandListItem,
  type AdminBrandCreateResponse,
} from "@/services/adminApi";
import { Copy, Pencil } from "lucide-react";

export function AdminBrandsView() {
  const [brands, setBrands] = useState<AdminBrandListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminBrandCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit dialog
  const [editBrand, setEditBrand] = useState<AdminBrandListItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    setCreateError(null);
    setCreated(null);
    try {
      const res = await createAdminBrand(newName.trim(), newEmail.trim());
      setCreated(res);
      setNewName("");
      setNewEmail("");
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
    try {
      if (brand.is_inactive) {
        await activateAdminBrand(brand.id);
      } else {
        await deactivateAdminBrand(brand.id);
      }
      fetchBrands();
    } catch {
      /* ignore */
    }
  };

  const openEdit = (brand: AdminBrandListItem) => {
    setEditBrand(brand);
    setEditName(brand.name);
    setEditEmail(brand.email);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editBrand) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updates: { name?: string; email?: string } = {};
      if (editName.trim() !== editBrand.name) updates.name = editName.trim();
      if (editEmail.trim() !== editBrand.email) updates.email = editEmail.trim();
      if (Object.keys(updates).length === 0) {
        setEditBrand(null);
        return;
      }
      await updateAdminBrand(editBrand.id, updates);
      setEditBrand(null);
      fetchBrands();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Ошибка обновления");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-foreground">Бренды</h2>

      {/* Create brand */}
      <div className="bg-card rounded-xl border border-border/30 p-5 space-y-4 max-w-md">
        <h3 className="text-sm font-medium text-foreground">Создать бренд</h3>
        <div className="space-y-2">
          <Label htmlFor="brand-name">Название</Label>
          <Input
            id="brand-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название бренда"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-email">Email</Label>
          <Input
            id="brand-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="brand@example.com"
          />
        </div>
        <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newEmail.trim()} size="sm">
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
                  <td className="px-4 py-3 flex gap-2">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editBrand} onOpenChange={(open) => !open && setEditBrand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать бренд</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditBrand(null)}>
                Отмена
              </Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
