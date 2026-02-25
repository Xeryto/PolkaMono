import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminReturns,
  lookupAdminOrder,
  logAdminReturn,
  AdminReturnItem,
  AdminOrderLookup,
} from "@/services/adminApi";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function AdminOrdersView() {
  const { token } = useAdminAuth();

  // Returns log state
  const [returns, setReturns] = useState<AdminReturnItem[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  // Log return form state
  const [orderIdInput, setOrderIdInput] = useState("");
  const [lookupResult, setLookupResult] = useState<AdminOrderLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchReturns = async () => {
    if (!token) return;
    setLoadingReturns(true);
    setReturnsError(null);
    try {
      const data = await getAdminReturns(token);
      setReturns(data);
    } catch {
      setReturnsError("Не удалось загрузить возвраты");
    } finally {
      setLoadingReturns(false);
    }
  };

  useEffect(() => {
    fetchReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSearch = async () => {
    if (!token || !orderIdInput.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    setSelectedItemIds(new Set());
    setSubmitSuccess(false);
    setSubmitError(null);
    try {
      const data = await lookupAdminOrder(token, orderIdInput.trim());
      setLookupResult(data);
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : "Ошибка поиска");
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!token || !lookupResult || selectedItemIds.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await logAdminReturn(token, lookupResult.order_id, Array.from(selectedItemIds));
      setSubmitSuccess(true);
      setOrderIdInput("");
      setLookupResult(null);
      setSelectedItemIds(new Set());
      await fetchReturns();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Ошибка при сохранении возврата");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-8">
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="h-5 w-5 text-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Возвраты</h2>
      </div>

      {/* Returns log table */}
      <div className="bg-card-custom/40 rounded-xl border border-brown-light/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-brown-light/20">
          <span className="text-sm font-semibold text-foreground">Журнал возвратов</span>
        </div>
        {loadingReturns ? (
          <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>
        ) : returnsError ? (
          <div className="p-4 text-sm text-red-500">{returnsError}</div>
        ) : returns.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Нет возвратов</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brown-light/20 text-muted-foreground text-xs uppercase">
                <th className="px-4 py-2 text-left font-medium">Order #</th>
                <th className="px-4 py-2 text-left font-medium">Товар</th>
                <th className="px-4 py-2 text-left font-medium">Бренд</th>
                <th className="px-4 py-2 text-left font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((row) => (
                <tr key={row.item_id} className="border-b border-brown-light/10 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-foreground">
                    {row.order_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2 text-foreground">{row.product_name}</td>
                  <td className="px-4 py-2 text-foreground">{row.brand_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(row.returned_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log a return form */}
      <div className="bg-card-custom/40 rounded-xl border border-brown-light/20 p-5 space-y-4">
        <span className="text-sm font-semibold text-foreground block">Зафиксировать возврат</span>

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="order-id-input" className="text-xs text-muted-foreground">
              Номер заказа (ID)
            </Label>
            <Input
              id="order-id-input"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="Введите ID заказа..."
              className="bg-background/50 border-brown-light/30 text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={lookupLoading || !orderIdInput.trim()}
            className="bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            {lookupLoading ? "Поиск..." : "Найти"}
          </Button>
        </div>

        {lookupError && <p className="text-sm text-red-500">{lookupError}</p>}

        {lookupResult && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Бренд: <span className="text-foreground font-medium">{lookupResult.brand_name}</span>
              {" · "}Order #{lookupResult.order_id.slice(0, 8)}
            </p>
            <div className="space-y-2">
              {lookupResult.items.map((item) => {
                const alreadyReturned = item.current_status === "returned";
                const checked = selectedItemIds.has(item.item_id);
                return (
                  <label
                    key={item.item_id}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      alreadyReturned
                        ? "border-brown-light/10 opacity-50 cursor-not-allowed"
                        : checked
                        ? "border-foreground/40 bg-foreground/5"
                        : "border-brown-light/20 hover:border-brown-light/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={alreadyReturned}
                      onChange={() => !alreadyReturned && toggleItem(item.item_id)}
                      className="accent-foreground"
                    />
                    <span className="text-sm text-foreground flex-1">{item.product_name}</span>
                    <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        alreadyReturned
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {alreadyReturned ? "возвращён" : item.current_status}
                    </span>
                  </label>
                );
              })}
            </div>
            {submitError && <p className="text-sm text-red-500">{submitError}</p>}
            {submitSuccess && (
              <p className="text-sm text-green-500">Возврат зафиксирован</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedItemIds.size === 0}
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? "Сохранение..." : "Зафиксировать возврат"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
