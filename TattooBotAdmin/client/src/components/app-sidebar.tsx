// client/src/components/app-sidebar.tsx
import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Calendar,
  FileSpreadsheet,
  Home,
  Image,
  MessageSquare,
  Settings,
  Users,
  BadgeCheck,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const menuItems = [
  { title: "Главная", url: "/", icon: Home },
  { title: "Мастера", url: "/masters", icon: Users },
  { title: "Услуги", url: "/services", icon: Settings },
  { title: "Записи", url: "/bookings", icon: Calendar },
  { title: "Портфолио", url: "/portfolio", icon: Image },
  { title: "Сообщения бота", url: "/bot-messages", icon: MessageSquare },
  { title: "Клиенты", url: "/clients", icon: Users },
  { title: "График", url: "/schedule", icon: Calendar },
  { title: "Акции", url: "/certs", icon: BadgeCheck },
  { title: "Excel", url: "/excel", icon: FileSpreadsheet },
  { title: "Настройки", url: "/settings", icon: Settings },
] as const;

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
  onLogout?: () => void;
  variant?: "desktop" | "mobile";
};

export default function AppSidebar({ className, onNavigate, onLogout, variant = "desktop" }: AppSidebarProps) {
  const [pathname] = useLocation();

  return (
    <aside
      className={cn(
        "flex h-full w-[240px] flex-col border-white/10 bg-[#14171f] text-white/90",
        variant === "desktop" && "sticky top-0 h-screen",
        variant === "mobile" && "w-full max-w-[260px]",
        className,
      )}
    >
      <div className="px-5 py-5">
        <p className="text-xs uppercase tracking-wide text-white/40">Telegram Bot</p>
        <p className="text-lg font-semibold">Admin панель</p>
      </div>
      <nav className="grid flex-1 gap-1 px-3 pb-6">
        {menuItems.map((item) => {
          const Icon = item.icon as React.ComponentType<React.SVGProps<SVGSVGElement>>;
          const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
          return (
            <Link
              key={item.url}
              href={item.url}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                "text-white/70 hover:bg-white/10 hover:text-white",
                isActive && "bg-white/10 text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          <span>Тема</span>
          <ThemeToggle />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onLogout}
          className="mt-3 w-full justify-center border-white/20 text-white/80 hover:bg-white/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
        <p className="mt-4 text-xs text-white/40">Версия панели 2.0</p>
        <p className="text-xs text-white/40">Обновлено для нового UI</p>
      </div>
    </aside>
  );
}
