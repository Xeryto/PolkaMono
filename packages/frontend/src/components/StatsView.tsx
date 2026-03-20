import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RotateCcw,
  RussianRuble,
  TrendingDown,
  TrendingUp,
  Package,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { getOrderStatusLabel, getOrderStatusColor } from "@/lib/orderStatus";

const statCards = [
  {
    key: "total_sold",
    label: "Всего продано на сумму",
    icon: TrendingUp,
    color: "text-green-500",
    bg: "from-green-500/10 to-transparent",
  },
  {
    key: "total_returned",
    label: "Возвраты",
    icon: RotateCcw,
    color: "text-orange-400",
    bg: "from-orange-400/10 to-transparent",
  },
  {
    key: "total_withdrawn",
    label: "Всего выведено",
    icon: TrendingDown,
    color: "text-muted-foreground",
    bg: "from-muted/10 to-transparent",
  },
  {
    key: "current_balance",
    label: "Текущий баланс",
    icon: RussianRuble,
    color: "text-brand",
    bg: "from-brand/10 to-transparent",
  },
] as const;

export function StatsView() {
  const [stats, setStats] = useState<api.BrandStatsResponse | null>(null);
  const [orders, setOrders] = useState<api.OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setIsLoading(false);
        toast.error("Токен аутентификации не найден. Войдите в систему.");
        return;
      }
      try {
        setIsLoading(true);
        const [fetchedStats, fetchedOrders] = await Promise.all([
          api.getBrandStats(token),
          api.getOrders(token),
        ]);
        setStats(fetchedStats);
        setOrders(fetchedOrders);
      } catch (error: unknown) {
        console.error("Failed to fetch stats:", error);
        const err = error as { message?: string };
        toast.error(err.message || "Не удалось загрузить статистику.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Статистика</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Статистика</h2>
        <EmptyStats />
      </div>
    );
  }

  const isEmpty =
    stats.total_sold === 0 &&
    stats.total_returned === 0 &&
    stats.total_withdrawn === 0 &&
    stats.current_balance === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Статистика</h2>
        <EmptyStats />
      </div>
    );
  }

  // Derive order status distribution
  const statusCounts: Record<string, number> = {};
  for (const order of orders) {
    const s = order.status?.toLowerCase() || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Статистика</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats[card.key];
          return (
            <Card
              key={card.key}
              className="bg-card border-border/30 hover:border-border/50 hover:shadow-md transition-all animate-fade-in group overflow-hidden relative"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <CardHeader className="pb-2 relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <div className={`p-2 rounded-lg bg-background/50 ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(value)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Order status summary */}
      {orders.length > 0 && (
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Распределение заказов по статусу
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className={`${getOrderStatusColor(status)} text-sm px-3 py-1`}
                >
                  {getOrderStatusLabel(status)}: {count}
                </Badge>
              ))}
              <Badge
                variant="outline"
                className="bg-card text-muted-foreground border-border/50 text-sm px-3 py-1"
              >
                Всего: {orders.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyStats() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Пока нет данных
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Статистика появится после первых продаж. Добавьте товары и ожидайте
        заказов.
      </p>
    </div>
  );
}
