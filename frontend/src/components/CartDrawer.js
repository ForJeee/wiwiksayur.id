import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "@/context/AppContext";
import { formatRupiah } from "@/lib/api";
import { fmtQty, lineTotal } from "@/lib/qty";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CartDrawer() {
  const { cartOpen, setCartOpen, cart, updateQty, removeItem, subtotal, user } = useApp();
  const nav = useNavigate();

  const goCheckout = () => {
    setCartOpen(false);
    if (!user) { nav("/auth?next=/checkout"); return; }
    nav("/checkout");
  };

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-white">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-emerald-950">
            <ShoppingBag className="w-5 h-5" /> Keranjang ({cart.length})
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-4 space-y-3">
          {cart.length === 0 && <p data-testid="cart-empty" className="text-center text-slate-500 py-16">Keranjang kosong</p>}
          {cart.map((i) => (
            <div key={i.product_id} data-testid={`cart-item-${i.product_id}`} className="flex gap-3 p-3 rounded-xl border border-emerald-900/10 bg-white">
              <img src={i.image_url} alt={i.name} className="w-16 h-16 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 line-clamp-2">{i.name}</p>
                <p className="text-xs text-slate-500">{formatRupiah(i.price)}/{i.unit}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button data-testid={`qty-dec-${i.product_id}`} onClick={() => updateQty(i.product_id, i.quantity - (i.unit === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-full border border-emerald-200 grid place-items-center hover:bg-emerald-50"><Minus className="w-3 h-3" /></button>
                  <span data-testid={`qty-${i.product_id}`} className="font-mono min-w-[3.5rem] text-center text-sm">{fmtQty(i.quantity, i.unit)}</span>
                  <button data-testid={`qty-inc-${i.product_id}`} onClick={() => updateQty(i.product_id, i.quantity + (i.unit === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-full border border-emerald-200 grid place-items-center hover:bg-emerald-50"><Plus className="w-3 h-3" /></button>
                  <span data-testid={`line-${i.product_id}`} className="ml-auto text-sm font-mono font-bold text-emerald-700">{formatRupiah(lineTotal(i.price, i.quantity))}</span>
                </div>
              </div>
              <button data-testid={`remove-${i.product_id}`} onClick={() => removeItem(i.product_id)} className="text-slate-400 hover:text-red-500 self-start"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between font-semibold text-emerald-950">
            <span>Subtotal</span>
            <span data-testid="cart-subtotal" className="font-mono">{formatRupiah(subtotal)}</span>
          </div>
          <Button
            data-testid="checkout-btn"
            disabled={cart.length === 0}
            onClick={goCheckout}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base font-semibold"
          >Lanjut ke Checkout</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
