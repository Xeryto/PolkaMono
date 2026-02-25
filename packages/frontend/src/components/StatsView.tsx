import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RussianRuble, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

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
    return <div>Загрузка статистики...</div>;
  }

  if (!stats) {
    return <div>Не удалось загрузить статистику.</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-card-custom-text">Статистика</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card-custom border-border/30 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-card-custom-text/70">
                Всего продано на сумму
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-custom-text">
              {formatCurrency(stats.total_sold)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card-custom border-border/30 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-card-custom-text/70">
                Всего выведено
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-custom-text">
              {formatCurrency(stats.total_withdrawn)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card-custom border-border/30 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-card-custom-text/70">
                Текущий баланс
              </CardTitle>
              <RussianRuble className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-custom-text">
              {formatCurrency(stats.current_balance)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
