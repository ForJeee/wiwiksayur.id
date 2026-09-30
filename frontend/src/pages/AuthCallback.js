import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const loc = useLocation();
  const nav = useNavigate();
  const { setUser } = useApp();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; done.current = true;
    const hash = loc.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/auth"); return; }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const r = await api.post("/auth/google/session", { session_id });
        localStorage.setItem("session_token", r.data.session_token);
        setUser(r.data.user);
        // Clean the URL
        window.history.replaceState(null, "", "/");
        toast.success(`Halo, ${r.data.user.name || r.data.user.email}!`);
        nav("/");
      } catch (e) {
        toast.error("Login Google gagal");
        nav("/auth");
      }
    })();
  }, [loc.hash, nav, setUser]);

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
        <p className="mt-4 text-emerald-950 font-semibold">Menyelesaikan login…</p>
      </div>
    </div>
  );
}
