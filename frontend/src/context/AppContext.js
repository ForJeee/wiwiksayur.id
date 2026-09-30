import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { fmtQty, lineTotal } from "@/lib/qty";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // If we're arriving via Emergent OAuth callback, let AuthCallback handle it
    if (window.location.hash?.includes("session_id=")) { setLoading(false); return; }
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("session_token", r.data.session_token);
    setUser(r.data.user);
    return r.data.user;
  };
  const register = async (payload) => {
    const r = await api.post("/auth/register", payload);
    localStorage.setItem("session_token", r.data.session_token);
    setUser(r.data.user);
    return r.data.user;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("session_token");
    setUser(null);
    toast.success("Berhasil keluar");
  };

  // Cart operations
  const addToCart = (product, qty = 1) => {
    setCart((c) => {
      const idx = c.findIndex((i) => i.product_id === product.product_id);
      if (idx >= 0) {
        const copy = [...c]; copy[idx] = { ...copy[idx], quantity: +(copy[idx].quantity + qty).toFixed(3) }; return copy;
      }
      return [...c, { product_id: product.product_id, name: product.name, price: product.price, unit: product.unit, image_url: product.image_url, quantity: qty }];
    });
    toast.success(`${product.name} ${fmtQty(qty, product.unit)} ditambahkan`);
  };
  const updateQty = (product_id, qty) => {
    setCart((c) => c.map((i) => {
      if (i.product_id !== product_id) return i;
      const min = i.unit === "kg" ? 0.1 : 1;
      return { ...i, quantity: +Math.max(min, qty).toFixed(3) };
    }));
  };
  const removeItem = (product_id) => setCart((c) => c.filter((i) => i.product_id !== product_id));
  const clearCart = () => setCart([]);
  const subtotal = cart.reduce((s, i) => s + lineTotal(i.price, i.quantity), 0);
  const totalItems = cart.length;

  return (
    <AppCtx.Provider value={{
      user, setUser, loading, refreshUser, login, register, logout,
      cart, cartOpen, setCartOpen, addToCart, updateQty, removeItem, clearCart, subtotal, totalItems,
    }}>{children}</AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
