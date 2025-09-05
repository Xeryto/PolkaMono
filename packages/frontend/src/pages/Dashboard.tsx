import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { OrdersView } from "@/components/OrdersView";
import { ProductsView } from "@/components/ProductsView";
import { StatsView } from "@/components/StatsView";
import { AddNewItemPage } from "@/pages/AddNewItemPage";
import { ProfileSettingsPage } from "@/pages/ProfileSettingsPage";

type DashboardView = 'stats' | 'orders' | 'products' | 'add-item' | 'profile';

const Dashboard = () => {
  const [currentView, setCurrentView] = useState<DashboardView>('stats');

  const renderView = () => {
    switch (currentView) {
      case 'orders':
        return <OrdersView />;
      case 'products':
        return <ProductsView />;
      case 'add-item':
        return <AddNewItemPage />;
      case 'profile':
        return <ProfileSettingsPage />;
      case 'stats':
        return <StatsView />;
      default: // Fallback for any unhandled view, or if 'stats' is still somehow set
        return <StatsView />; // Default to OrdersView if stats is hidden
    }
  };

  return (
    <SidebarProvider>
            <div className="min-h-screen flex w-full bg-gradient-ominous">
        <DashboardSidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          
          <main className="flex-1 p-6">
            {renderView()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;