import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RussianRuble, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import { useToast } from "@/hooks/use-toast";

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
          title: "Error",
          description: "Authentication token not found. Please log in.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        const fetchedStats = await api.getBrandStats(token);
        setStats(fetchedStats);
      } catch (error: any) {
        console.error("Failed to fetch stats:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load statistics.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token, toast]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (isLoading) {
    return <div>Loading statistics...</div>;
  }

  if (!stats) {
    return <div>Could not load statistics.</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Statistics</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sold</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.total_sold)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawn</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.total_withdrawn)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
              <RussianRuble className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.current_balance)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
