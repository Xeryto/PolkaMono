import { Bell, User } from "lucide-react";
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

type DashboardView = "stats" | "orders" | "products" | "add-item" | "profile" | "security";

interface DashboardHeaderProps {
  onViewChange: (view: DashboardView) => void;
}

export function DashboardHeader({ onViewChange }: DashboardHeaderProps) {
  const { logout } = useAuth();

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
        <Button variant="ghost" size="icon" className="hover:bg-brown-dark/50">
          <Bell className="h-4 w-4" />
        </Button>

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
