import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, User, LogOut, Award, LayoutDashboard, Leaf } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function Navbar() {
  const { user, totalItems, setCartOpen, logout } = useApp();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-emerald-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-16">
        <Link to="/" data-testid="brand-home" className="flex items-center gap-2 group">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 grid place-items-center shadow-sm ring-1 ring-emerald-900/10">
            <Leaf className="w-5 h-5 text-white" />
          </span>
          <span className="font-extrabold tracking-tight text-emerald-950 text-lg">wiwiksayur<span className="text-emerald-600">.com</span></span>
        </Link>
        <nav className="ml-6 hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link to="/" data-testid="nav-home" className="hover:text-emerald-700">Belanja</Link>
          {user && <Link to="/profile" data-testid="nav-profile" className="hover:text-emerald-700">Pesanan Saya</Link>}
          {user?.role === "admin" && (
            <Link to="/admin" data-testid="nav-admin" className="hover:text-emerald-700 flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" /> Admin
            </Link>
          )}
        </nav>
        <div className="flex-1" />
        <button
          data-testid="open-cart-btn"
          onClick={() => setCartOpen(true)}
          className="relative rounded-full p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition"
          aria-label="Buka keranjang"
        >
          <ShoppingBag className="w-5 h-5" />
          {totalItems > 0 && (
            <span data-testid="cart-count" className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 grid place-items-center">
              {totalItems}
            </span>
          )}
        </button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu-btn" className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border border-emerald-900/10 hover:bg-emerald-50 transition">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white text-xs font-bold grid place-items-center">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-800 hidden sm:inline">{user.name?.split(" ")[0] || "Akun"}</span>
                {user.is_pelanggan_setia && (
                  <Award className="w-4 h-4 text-amber-500" data-testid="loyalty-badge-icon" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs text-slate-500">{user.email}</div>
                {user.is_pelanggan_setia && (
                  <Badge className="mt-1 loyal-shimmer text-amber-950 border-0" data-testid="loyalty-badge-menu">Pelanggan Setia</Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-profile" onClick={() => nav("/profile")}>
                <User className="w-4 h-4 mr-2" /> Profil & Pesanan
              </DropdownMenuItem>
              {user.role === "admin" && (
                <DropdownMenuItem data-testid="menu-admin" onClick={() => nav("/admin")}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Admin Dashboard
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-logout" onClick={logout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button data-testid="nav-login-btn" onClick={() => nav("/auth")} className="bg-emerald-600 hover:bg-emerald-700">Masuk</Button>
        )}
      </div>
    </header>
  );
}
