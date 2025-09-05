import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RussianRuble, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

// Mock stats data
const mockStats = {
  totalSold: 12500,
  totalWithdrawn: 5000,
  currentBalance: 7500,
};

export function StatsView() {
  const [stats, setStats] = useState(mockStats);

  // TODO: Fetch real data from the API
  useEffect(() => {
    // fetch('/api/stats')
    //   .then(res => res.json())
    //   .then(data => setStats(data));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount);
  };

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
              {formatCurrency(stats.totalSold)}
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
              {formatCurrency(stats.totalWithdrawn)}
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
              {formatCurrency(stats.currentBalance)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
