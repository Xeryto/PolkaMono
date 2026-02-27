import { useCallback, useEffect, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  searchBrands,
  recordWithdrawal,
  getWithdrawals,
  BrandSearchResult,
  WithdrawalRecord,
} from "@/services/adminApi";
import { formatCurrency } from "@/lib/currency";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function AdminWithdrawalsView() {
  const { token } = useAdminAuth();

  // Brand search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BrandSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<BrandSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Form
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // History
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async (brandId?: string) => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const data = await getWithdrawals(token, brandId);
      setHistory(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  // Debounced brand search
  useEffect(() => {
    if (!token || searchQuery.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchBrands(token, searchQuery);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, token]);

  // Load history when brand selected
  useEffect(() => {
    if (selectedBrand) {
      fetchHistory(selectedBrand.id);
    }
  }, [selectedBrand, fetchHistory]);

  const handleSelectBrand = (brand: BrandSearchResult) => {
    setSelectedBrand(brand);
    setSearchQuery(brand.name);
    setShowDropdown(false);
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!token || !selectedBrand || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setSubmitError("Введите корректную сумму");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await recordWithdrawal(token, selectedBrand.id, numAmount, note || undefined);
      setSubmitSuccess(true);
      setAmount("");
      setNote("");
      // Refresh brand withdrawn total
      setSelectedBrand((prev) =>
        prev ? { ...prev, amount_withdrawn: prev.amount_withdrawn + numAmount } : prev
      );
      await fetchHistory(selectedBrand.id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-8">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="h-5 w-5 text-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Выводы</h2>
      </div>

      {/* Brand search */}
      <div className="bg-card-custom/40 rounded-xl border border-brown-light/20 p-5 space-y-4">
        <span className="text-sm font-semibold text-foreground block">Выбрать бренд</span>
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (selectedBrand && e.target.value !== selectedBrand.name) {
                setSelectedBrand(null);
              }
            }}
            placeholder="Поиск бренда по названию..."
            className="bg-background/50 border-brown-light/30 text-foreground placeholder:text-muted-foreground"
          />
          {showDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-card-custom border border-brown-light/20 rounded-lg shadow-lg max-h-48 overflow-auto">
              {searchResults.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelectBrand(b)}
                  className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-foreground/5 flex justify-between"
                >
                  <span>{b.name}</span>
                  <span className="text-muted-foreground text-xs">
                    Выведено: {formatCurrency(b.amount_withdrawn)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedBrand && (
          <div className="text-sm text-muted-foreground">
            Бренд: <span className="text-foreground font-medium">{selectedBrand.name}</span>
            {" · "}Выведено: <span className="text-foreground">{formatCurrency(selectedBrand.amount_withdrawn)}</span>
          </div>
        )}
      </div>

      {/* Withdrawal form */}
      {selectedBrand && (
        <div className="bg-card-custom/40 rounded-xl border border-brown-light/20 p-5 space-y-4">
          <span className="text-sm font-semibold text-foreground block">Записать вывод</span>

          <div className="space-y-1">
            <Label htmlFor="withdrawal-amount" className="text-xs text-muted-foreground">
              Сумма
            </Label>
            <Input
              id="withdrawal-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-background/50 border-brown-light/30 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="withdrawal-note" className="text-xs text-muted-foreground">
              Примечание (необязательно)
            </Label>
            <textarea
              id="withdrawal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Комментарий к выводу..."
              maxLength={500}
              rows={2}
              className="w-full rounded-md bg-background/50 border border-brown-light/30 text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}
          {submitSuccess && <p className="text-sm text-green-500">Вывод записан</p>}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !amount}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? "Сохранение..." : "Записать вывод"}
          </Button>
        </div>
      )}

      {/* Withdrawal history */}
      {selectedBrand && (
        <div className="bg-card-custom/40 rounded-xl border border-brown-light/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-brown-light/20">
            <span className="text-sm font-semibold text-foreground">История выводов</span>
          </div>
          {loadingHistory ? (
            <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>
          ) : history.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Нет выводов</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brown-light/20 text-muted-foreground text-xs uppercase">
                  <th className="px-4 py-2 text-left font-medium">Дата</th>
                  <th className="px-4 py-2 text-left font-medium">Сумма</th>
                  <th className="px-4 py-2 text-left font-medium">Примечание</th>
                  <th className="px-4 py-2 text-left font-medium">Админ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-brown-light/10 last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-2 text-foreground font-medium">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2 text-foreground">{row.note || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{row.admin_email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
