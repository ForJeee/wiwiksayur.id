import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Leaf } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/auth-callback";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Auth() {
  const { login, register } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const next = new URLSearchParams(loc.search).get("next") || "/";
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Selamat datang kembali!");
      } else {
        if (form.password !== form.confirm) { toast.error("Konfirmasi kata sandi tidak cocok"); setBusy(false); return; }
        await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
        toast.success("Akun berhasil dibuat!");
      }
      nav(next);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-5 bg-[#FDFBF7]">
      <div className="hidden lg:flex lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 p-12 items-end">
        <img src="https://images.unsplash.com/photo-1591586116988-62fe65164f8d?w=1200&auto=format" className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
        <div className="relative z-10 text-white">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-10 h-10 rounded-xl bg-amber-400 grid place-items-center"><Leaf className="w-6 h-6 text-emerald-950" /></span>
            <span className="font-extrabold text-2xl">wiwiksayur.com</span>
          </div>
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight">Sayur segar dari petani,<br/>langsung ke dapur Anda.</h2>
          <p className="mt-4 text-white/80">Belanja mudah, harga transparan, dan pesanan Anda dijaga dengan sistem Pelanggan Setia.</p>
        </div>
      </div>
      <div className="lg:col-span-3 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold text-emerald-950 tracking-tight">{mode === "login" ? "Masuk ke akun Anda" : "Buat akun baru"}</h1>
          <p className="mt-1 text-slate-600">{mode === "login" ? "Lanjutkan belanja sayur segar." : "Gratis, hanya perlu beberapa detik."}</p>

          <Button data-testid="google-login-btn" onClick={googleLogin} variant="outline" className="mt-6 w-full h-11 border-emerald-900/15">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.7 2.7 30.2.5 24 .5 14.6.5 6.6 5.8 2.6 13.6l7.8 6C12.3 14 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.3z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-7.8-6C1.1 17.1 0 20.4 0 24s1.1 6.9 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 47.5c6.2 0 11.5-2.1 15.3-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.8 2.2-6.3 0-11.7-4.4-13.6-10.4l-7.8 6C6.6 42.2 14.6 47.5 24 47.5z"/></svg>
            Lanjutkan dengan Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" /> atau <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger data-testid="tab-login" value="login">Masuk</TabsTrigger>
              <TabsTrigger data-testid="tab-register" value="register">Daftar</TabsTrigger>
            </TabsList>
            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === "register" && (
                <>
                  <div><Label>Nama Lengkap</Label><Input data-testid="input-name" required value={form.name} onChange={set("name")} placeholder="Contoh: Budi Santoso" /></div>
                  <div><Label>Nomor HP</Label><Input data-testid="input-phone" required value={form.phone} onChange={set("phone")} placeholder="+628123456789" /></div>
                </>
              )}
              <div><Label>Email</Label><Input data-testid="input-email" required type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" /></div>
              <div><Label>Kata Sandi</Label><Input data-testid="input-password" required type="password" minLength={6} value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" /></div>
              {mode === "register" && (
                <div><Label>Konfirmasi Kata Sandi</Label><Input data-testid="input-confirm" required type="password" value={form.confirm} onChange={set("confirm")} /></div>
              )}
              <Button data-testid="submit-auth-btn" type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-base font-semibold">
                {busy ? "Memproses..." : (mode === "login" ? "Masuk" : "Buat Akun")}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
