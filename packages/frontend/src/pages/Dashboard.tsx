import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { OrdersView } from "@/components/OrdersView";
import { ProductsView } from "@/components/ProductsView";
import { StatsView } from "@/components/StatsView";
import { AddNewItemPage } from "@/pages/AddNewItemPage";
import { ProfileSettingsPage } from "@/pages/ProfileSettingsPage";
import { SecuritySettingsPage } from "@/pages/SecuritySettingsPage";
import type { DashboardView } from "@/types/dashboard";

const Dashboard = () => {
  const [currentView, setCurrentView] = useState<DashboardView>("stats");
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "orders":
        return (
          <OrdersView
            targetOrderId={targetOrderId}
            onTargetConsumed={() => setTargetOrderId(null)}
          />
        );
      case "products":
        return <ProductsView />;
      case "add-item":
        return <AddNewItemPage />;
      case "profile":
        return <ProfileSettingsPage />;
      case "security":
        return <SecuritySettingsPage />;
      case "stats":
      default:
        return <StatsView />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar currentView={currentView} onViewChange={setCurrentView} />

        <div className="flex-1 flex flex-col">
          <DashboardHeader
            currentView={currentView}
            onViewChange={setCurrentView}
            onTargetOrder={setTargetOrderId}
          />

          <main className="flex-1 p-6">
            <div key={currentView} className="animate-fade-in">
              {renderView()}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
