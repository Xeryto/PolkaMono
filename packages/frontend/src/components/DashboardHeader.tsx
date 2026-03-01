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
  if (type === "new_order") return <ShoppingBag className="h-4 w-4 text-brand shrink-0" />;
  if (type === "return_logged") return <Package className="h-4 w-4 text-orange-400 shrink-0" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function formatRelativeTime(isoString: string): string {
  // Ensure UTC interpretation — append Z if no timezone offset present
  let iso = isoString;
  if (!/([Zz]|[+-]\d{2}:\d{2})$/.test(iso)) iso += "Z";
  const diff = Date.now() - new Date(iso).getTime();
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
  const [bellOpen, setBellOpen] = useState(false);
  const [, tick] = useState(0);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Re-render every 60s so relative timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchNotifications(token);
      setNotifications(data.notifications);
    } catch {
      // silently fail — bell just shows empty
    }
  }, [token]);

  // Poll every 30 seconds; pause when tab is hidden, refresh on return
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      if (!document.hidden) loadNotifications();
    }, 30_000);
    const onVisible = () => { if (!document.hidden) loadNotifications(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [loadNotifications]);

  const handleBellOpen = useCallback((open: boolean) => {
    setBellOpen(open);
    if (open && unreadCount > 0 && token) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      markNotificationsRead(token).catch(() => {});
    }
  }, [unreadCount, token]);

  return (
    <header className="relative h-16 bg-card/50 border-b border-border/30 flex items-center justify-between px-4 sm:px-6 gap-2 before:absolute before:inset-y-0 before:right-full before:w-[--sidebar-width] before:bg-card/50 before:border-b before:border-border/30">
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card border-border text-card-foreground shadow-lg">
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
                  className={`flex items-start gap-2 px-3 py-2 cursor-pointer ${!notif.is_read ? "bg-accent/50" : ""}`}
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
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-card border-border text-card-foreground shadow-lg"
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
