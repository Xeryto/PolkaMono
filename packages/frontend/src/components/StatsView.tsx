import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, RussianRuble, TrendingDown, TrendingUp, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

function StatSkeleton() {
  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted/30 rounded animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
          <div className="h-4 w-4 bg-muted/30 rounded animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-8 w-32 bg-muted/30 rounded animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
      </CardContent>
    </Card>
  );
}

function EmptyStats() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-1">Пока нет данных</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Статистика появится после первых продаж. Добавьте товары и ожидайте заказов.
      </p>
    </div>
  );
}

const statCards = [
  {
    key: "total_sold",
    label: "Всего продано на сумму",
    icon: TrendingUp,
    color: "text-green-500",
  },
  {
    key: "total_returned",
    label: "Возвраты",
    icon: RotateCcw,
    color: "text-orange-400",
  },
  {
    key: "total_withdrawn",
    label: "Всего выведено",
    icon: TrendingDown,
    color: "text-muted-foreground",
  },
  {
    key: "current_balance",
    label: "Текущий баланс",
    icon: RussianRuble,
    color: "text-brand",
  },
] as const;

export function StatsView() {
  const [stats, setStats] = useState<api.BrandStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) {
        setIsLoading(false);
        toast({
          title: "Ошибка",
          description:
            "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        const fetchedStats = await api.getBrandStats(token);
        setStats(fetchedStats);
      } catch (error: unknown) {
        console.error("Failed to fetch stats:", error);
        const err = error as { message?: string };
        toast({
          title: "Ошибка",
          description: err.message || "Не удалось загрузить статистику.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token, toast]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Статистика</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatSkeleton key={i} />
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
              className="bg-card border-border/30 hover:border-border/50 transition-colors animate-fade-in"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(value)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
