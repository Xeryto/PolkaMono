import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { OrderDetailsPage } from "@/pages/OrderDetailsPage";
import * as api from "@/services/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { getOrderStatusLabel, getOrderStatusColor } from "@/lib/orderStatus";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
} from "lucide-react";

interface OrdersViewProps {
  targetOrderId?: string | null;
  onTargetConsumed?: () => void;
}

type SortField = "date" | "total_amount" | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [10, 25, 50];

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "created", label: "Создан" },
  { value: "pending", label: "Ожидание" },
  { value: "paid", label: "Оплачен" },
  { value: "shipped", label: "Отправлен" },
  { value: "returned", label: "Возвращён" },
  { value: "partially_returned", label: "Частично возвращён" },
  { value: "canceled", label: "Отменён" },
];

export function OrdersView({ targetOrderId, onTargetConsumed }: OrdersViewProps) {
  const [orders, setOrders] = useState<api.OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<api.OrderResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const { token } = useAuth();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!token) {
        setIsLoading(false);
        toast.error("Токен аутентификации не найден. Войдите в систему.");
        return;
      }
      try {
        setIsLoading(true);
        const fetchedOrders = await api.getOrders(token);
        setOrders(fetchedOrders);
      } catch (error: unknown) {
        console.error("Failed to fetch orders:", error);
        const err = error as { message?: string };
        toast.error(err.message || "Не удалось загрузить заказы.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [token]);

  // Fetch detail order
  useEffect(() => {
    if (!selectedOrderId || !token) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    setSelectedOrder(null);
    api
      .getOrder(selectedOrderId, token)
      .then((order) => { if (!cancelled) setSelectedOrder(order); })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || "Не удалось загрузить заказ.");
      })
      .finally(() => {
        if (!cancelled) { setIsLoadingDetail(false); setSelectedOrderId(null); }
      });
    return () => { cancelled = true; };
  }, [selectedOrderId, token]);

  // Scroll to targeted order from notification
  useEffect(() => {
    if (!targetOrderId) return;
    const el = document.querySelector(`[data-order-id="${targetOrderId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-brand", "transition-all");
      const timer = setTimeout(() => {
        el.classList.remove("ring-2", "ring-brand");
        onTargetConsumed?.();
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      onTargetConsumed?.();
    }
  }, [targetOrderId, onTargetConsumed]);

  // Filter → sort → paginate pipeline
  const processed = useMemo(() => {
    let result = [...orders];

    // Search by order number
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((o) => o.number.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status?.toLowerCase() === statusFilter);
    }

    // Date range
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((o) => new Date(o.date).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // include end date
      result = result.filter((o) => new Date(o.date).getTime() < to);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === "total_amount") cmp = a.total_amount - b.total_amount;
      else if (sortField === "status") cmp = (a.status || "").localeCompare(b.status || "");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [orders, search, statusFilter, dateFrom, dateTo, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = processed.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Detail view
  if (isLoadingDetail || selectedOrder) {
    if (selectedOrder) {
      return (
        <OrderDetailsPage
          order={selectedOrder}
          onBack={() => { setSelectedOrder(null); setSelectedOrderId(null); }}
          onOrderUpdated={async () => {
            if (token && selectedOrder) {
              const updated = await api.getOrder(selectedOrder.id, token);
              setSelectedOrder(updated);
              const list = await api.getOrders(token);
              setOrders(list);
            }
          }}
        />
      );
    }
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Заказы</h2>

      <Card className="bg-card border-border/30 shadow-sm">
        <CardHeader>
          <CardTitle>Все заказы</CardTitle>
          <CardDescription>Просмотр и управление заказами клиентов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру заказа..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-input border-border/50"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onClear={() => { setDateFrom(""); setDateTo(""); }}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Заказов пока нет</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Заказы появятся здесь, когда покупатели оформят покупку.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border/30 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Номер</TableHead>
                      <TableHead>Трекинг</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("total_amount")}
                      >
                        <span className="flex items-center">
                          Сумма <SortIcon field="total_amount" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("date")}
                      >
                        <span className="flex items-center">
                          Дата <SortIcon field="date" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort("status")}
                      >
                        <span className="flex items-center">
                          Статус <SortIcon field="status" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Ничего не найдено
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((order) => (
                        <TableRow
                          key={order.id}
                          data-order-id={order.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <TableCell className="font-medium">
                            № {order.number}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {order.tracking_number || "—"}
                          </TableCell>
                          <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(order.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getOrderStatusColor(order.status)}
                              variant="outline"
                            >
                              {getOrderStatusLabel(order.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Показано {paginated.length} из {processed.length}</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => setPageSize(Number(v))}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>на стр.</span>
                </div>

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev && p - prev > 1;
                          return (
                            <span key={p} className="contents">
                              {showEllipsis && (
                                <PaginationItem>
                                  <span className="px-2 text-muted-foreground">...</span>
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setPage(p)}
                                  isActive={p === safePage}
                                  className="cursor-pointer"
                                >
                                  {p}
                                </PaginationLink>
                              </PaginationItem>
                            </span>
                          );
                        })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className={safePage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
