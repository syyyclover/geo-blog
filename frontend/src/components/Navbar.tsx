import { Link, useLocation, useNavigate } from "react-router-dom";
import { Map, Book, User, Globe, LogIn, LogOut, Settings } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { isAuthenticated, clearToken } from "@/src/lib/auth";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = isAuthenticated();

  const navItems = [
    { name: "Map", path: "/", icon: Map },
    { name: "Notes", path: "/notes", icon: Book },
    { name: "About", path: "/about", icon: User },
  ];

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
      <div className="flex items-center gap-8 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-lg">
        <Link to="/" className="flex items-center gap-2 text-white font-bold tracking-tight">
          <Globe className="w-6 h-6 text-blue-400" />
          <span className="hidden sm:inline">Geo-Blog</span>
        </Link>

        <div className="h-6 w-px bg-white/20" />

        <div className="flex items-center gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200",
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="h-6 w-px bg-white/20" />

        {authed ? (
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200",
                location.pathname === "/admin"
                  ? "bg-blue-500/30 text-blue-300"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Admin</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">退出</span>
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <LogIn className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">登录</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
