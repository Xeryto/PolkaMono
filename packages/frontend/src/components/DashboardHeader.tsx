import { Bell, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

export function DashboardHeader() {
  const { logout } = useAuth();

  return (
    <header className="h-16 bg-card-custom/30 border-b border-brown-light/20 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">
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
            className="bg-card-custom border-brown-light/30"
          >
            <DropdownMenuLabel>Аккаунт бренда</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Настройки профиля</DropdownMenuItem>
            <DropdownMenuItem>Безопасность</DropdownMenuItem>
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
