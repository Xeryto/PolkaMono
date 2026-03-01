import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { getOrderStatusLabel } from "@/lib/orderStatus";
import { getAdminOrders, AdminOrderSummary } from "@/services/adminApi";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

export function AdminInflowView() {
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const orders: AdminOrderSummary[] = await getAdminOrders(
        dateFrom || undefined,
        dateTo || undefined,
      );
      const rows = orders.map((o) => ({
        "№ Заказа": o.number,
        "Дата": new Date(o.date).toLocaleDateString(),
        "Бренд": o.brand_name,
        "Статус": getOrderStatusLabel(o.status),
        "Цена товаров": o.total_amount - (o.shipping_cost ?? 0),
        "Сумма доставки": o.shipping_cost ?? 0,
        "Итого": o.total_amount,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Заказы");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Заказы_${date}.xlsx`);
    } catch {
      // silent — admin can retry
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-8">
      <div className="flex items-center gap-2 mb-2">
        <FileSpreadsheet className="h-5 w-5 text-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Приход по заказам</h2>
      </div>

      <div className="bg-card rounded-xl border border-border/30 p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Экспорт заказов в Excel — цены товаров, стоимость доставки, итого по каждому заказу с указанием бренда.
        </p>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={() => { setDateFrom(""); setDateTo(""); }}
        />
        <Button onClick={handleExportExcel} disabled={exporting} className="gap-2">
          <Download className="h-4 w-4" />
          {exporting ? "Экспорт..." : "Скачать Excel"}
        </Button>
      </div>
    </div>
  );
}
