import { useEffect, useState, useCallback } from "react";
import { Bell, User, ShoppingBag, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNotifications,
  markNotificationsRead,
  NotificationItem,
} from "@/services/api";

type DashboardView = "stats" | "orders" | "products" | "add-item" | "profile" | "security";

interface DashboardHeaderProps {
  onViewChange: (view: DashboardView) => void;
  onTargetOrder: (orderId: string | null) => void;
}

function notifIcon(type: string) {
  if (type === "new_order") return <ShoppingBag className="h-4 w-4 text-brown-light shrink-0" />;
  if (type === "return_logged") return <Package className="h-4 w-4 text-orange-400 shrink-0" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export function DashboardHeader({ onViewChange, onTargetOrder }: DashboardHeaderProps) {
  const { logout, token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchNotifications(token);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // silently fail — bell just shows empty
    }
  }, [token]);

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleBellOpen = useCallback(async (open: boolean) => {
    setBellOpen(open);
    if (open && unreadCount > 0 && token) {
      try {
        await markNotificationsRead(token);
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch {
        // ignore
      }
    }
  }, [unreadCount, token]);

  return (
    <header className="h-16 bg-card-custom/30 border-b border-brown-light/20 flex items-center justify-between px-4 sm:px-6 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger
          className="shrink-0 md:hidden"
          aria-label="Открыть меню"
        />
        <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
          Панель управления Polka
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu open={bellOpen} onOpenChange={handleBellOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-brown-dark/50 relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-[hsl(var(--card-custom))] border-brown-light/40 text-card-foreground shadow-lg">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Уведомления
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Нет уведомлений
              </div>
            ) : (
              notifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className={`flex items-start gap-2 px-3 py-2 cursor-pointer ${!notif.is_read ? "bg-brown-dark/10" : ""}`}
                  onSelect={() => {
                    onTargetOrder(notif.order_id ?? null);
                    onViewChange("orders");
                  }}
                >
                  {notifIcon(notif.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(notif.created_at)}</p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-brown-dark/50"
            >
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[hsl(var(--card-custom))] border-brown-light/40 text-card-foreground shadow-lg"
          >
            <DropdownMenuLabel>Аккаунт бренда</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onViewChange("profile")}>Настройки профиля</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewChange("security")}>Безопасность</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={logout}>
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
