import { useEffect, useState } from "react";
import {
  BarChart3,
  Package,
  ShoppingCart,
  LogOut,
  PlusSquare,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/services/api";
import type { DashboardView } from "@/types/dashboard";

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

const shopItems = [
  { id: "stats" as const, title: "Статистика", icon: BarChart3 },
  { id: "orders" as const, title: "Заказы", icon: ShoppingCart },
  { id: "products" as const, title: "Товары", icon: Package },
  { id: "add-item" as const, title: "Добавить товар", icon: PlusSquare },
];

export function DashboardSidebar({ currentView, onViewChange }: DashboardSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { token } = useAuth();
  const [brandName, setBrandName] = useState<string>("");
  const [brandLogo, setBrandLogo] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    api.getBrandProfile(token)
      .then((profile) => {
        setBrandName(profile.name);
        if (profile.logo) setBrandLogo(profile.logo);
      })
      .catch(() => {});
  }, [token]);

  const handleViewChange = (view: DashboardView) => {
    onViewChange(view);
    if (isMobile) setOpenMobile(false);
  };

  const renderMenu = (items: typeof shopItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          onClick={() => handleViewChange(item.id)}
          className={`${
            currentView === item.id
              ? "sidebar-menu-button-active"
              : "sidebar-menu-button-hover"
          } transition-colors`}
        >
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar className="bg-card border-r border-border/30" collapsible="icon">
      {/* Brand header */}
      <div className="h-16 flex items-center gap-2 px-3 border-b border-border/30 shrink-0">
        {brandLogo ? (
          <img src={brandLogo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-brand">{brandName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {!collapsed && brandName && (
          <span className="text-sm font-semibold text-foreground truncate">{brandName}</span>
        )}
        <SidebarTrigger className="hidden md:flex ml-auto" />
      </div>

      <SidebarContent>
        {/* Shop group */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">Магазин</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderMenu(shopItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => { window.location.href = "/portal"; }}
                  className="hover:bg-destructive/20 text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Выйти</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
