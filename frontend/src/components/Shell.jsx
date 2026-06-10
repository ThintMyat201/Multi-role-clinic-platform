import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { TID } from "@/constants/testIds";
import { LogOut, Menu, X } from "lucide-react";

export function Shell({ navItems = [], children, accent = "honey", title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMobile, setOpenMobile] = useState(false);

  const sidebarBg =
    accent === "admin"
      ? "bg-[hsl(21,91%,12%)] text-[hsl(40,100%,94%)] border-r border-[hsl(22,40%,22%)]"
      : "bg-white text-foreground border-r border-border";

  const navItemCls = (active) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      active
        ? accent === "admin"
          ? "bg-[hsl(32,95%,44%)] text-white"
          : "bg-[hsl(38,92%,50%)]/15 text-[hsl(21,91%,14%)]"
        : accent === "admin"
        ? "text-[hsl(38,40%,80%)] hover:bg-white/5"
        : "text-muted-foreground hover:bg-muted"
    }`;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const SidebarContent = (
    <div className={`flex flex-col h-full ${sidebarBg}`}>
      <div className="px-5 py-6 border-b border-inherit/50">
        <BrandMark subtitle={title || "Physiotherapy"} />
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1.5">
        {navItems.map((item) => {
          const [itemPath, itemHash = ""] = item.to.split("#");
          const currentHash = (location.hash || "").replace("#", "");
          const active =
            location.pathname === itemPath &&
            (itemHash ? currentHash === itemHash : currentHash === "");
          return (
            <Link
              key={item.to}
              to={item.to}
              data-testid={TID.shellNav(item.key)}
              onClick={() => setOpenMobile(false)}
              className={navItemCls(active)}
            >
              {item.icon && <item.icon size={18} />}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={`px-4 py-4 border-t ${accent === "admin" ? "border-white/10" : "border-border"}`}>
        <div className="mb-3 text-xs">
          <div className={`font-semibold ${accent === "admin" ? "text-white" : "text-foreground"}`}>
            {user?.name}
          </div>
          <div className={`${accent === "admin" ? "text-white/60" : "text-muted-foreground"} capitalize`}>
            {user?.role}
          </div>
        </div>
        <Button
          data-testid={TID.shellLogout}
          onClick={handleLogout}
          variant={accent === "admin" ? "secondary" : "outline"}
          className="w-full rounded-full"
          size="sm"
        >
          <LogOut size={14} className="mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 sticky top-0 h-screen">{SidebarContent}</aside>

      {/* Mobile drawer */}
      {openMobile && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenMobile(false)} />
          <div className="absolute left-0 top-0 h-full w-72">{SidebarContent}</div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-white/85 backdrop-blur border-b border-border">
          <button
            aria-label="Open menu"
            onClick={() => setOpenMobile(true)}
            className="p-2 rounded-lg border border-border"
          >
            {openMobile ? <X size={18} /> : <Menu size={18} />}
          </button>
          <BrandMark />
          <div className="w-9" />
        </header>
        <div className="p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
