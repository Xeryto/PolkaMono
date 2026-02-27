import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { AdminNotificationsView } from "./AdminNotificationsView";
import { AdminOrdersView } from "./AdminOrdersView";
import { AdminWithdrawalsView } from "./AdminWithdrawalsView";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, RotateCcw, Wallet } from "lucide-react";

type AdminView = "notifications" | "orders" | "withdrawals";

const AdminDashboard = () => {
  const { logout } = useAdminAuth();
  const [currentView, setCurrentView] = useState<AdminView>("notifications");

  const renderView = () => {
    switch (currentView) {
      case "notifications":
        return <AdminNotificationsView />;
      case "orders":
        return <AdminOrdersView />;
      case "withdrawals":
        return <AdminWithdrawalsView />;
      default:
        return <AdminNotificationsView />;
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-ominous">
      {/* Sidebar */}
      <aside className="w-56 bg-card-custom/40 border-r border-brown-light/20 flex flex-col">
        <div className="p-4 border-b border-brown-light/20">
          <span className="text-sm font-semibold text-foreground">Admin Panel</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setCurrentView("notifications")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentView === "notifications"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>
          <button
            onClick={() => setCurrentView("orders")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentView === "orders"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            Возвраты
          </button>
          <button
            onClick={() => setCurrentView("withdrawals")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentView === "withdrawals"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Выводы
          </button>
        </nav>

        <div className="p-3 border-t border-brown-light/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
};

export default AdminDashboard;
