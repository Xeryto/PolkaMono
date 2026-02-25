import {
  BarChart3,
  Package,
  ShoppingCart,
  LogOut,
  PlusSquare,
  Bell,
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

type DashboardView = "stats" | "orders" | "products" | "add-item" | "profile" | "security" | "admin-notifications";

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

const menuItems = [
  { id: "stats", title: "Статистика", icon: BarChart3 },
  { id: "orders", title: "Заказы", icon: ShoppingCart },
  { id: "products", title: "Товары", icon: Package },
  { id: "add-item", title: "Добавить товар", icon: PlusSquare },
];

export function DashboardSidebar({
  currentView,
  onViewChange,
}: DashboardSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const handleViewChange = (view: DashboardView) => {
    onViewChange(view);
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = () => {
    window.location.href = "/portal";
  };

  return (
    <Sidebar
      className={`${
        collapsed ? "w-14" : "w-60"
      } bg-card-custom border-r border-border/30`}
      collapsible="icon"
    >
      <SidebarTrigger className="m-2 self-end hidden md:flex" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => handleViewChange(item.id as DashboardView)}
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleViewChange("admin-notifications")}
                  className={`${
                    currentView === "admin-notifications"
                      ? "sidebar-menu-button-active"
                      : "sidebar-menu-button-hover"
                  } transition-colors`}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Рассылка (Админ)</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
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
