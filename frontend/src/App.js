import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import Checkout from "@/pages/Checkout";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import PaymentResult from "@/pages/PaymentResult";
import Track from "@/pages/Track";

function AppRouter() {
  const location = useLocation();
  // If Emergent OAuth returns via hash, route to AuthCallback synchronously
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <>
      <Navbar />
      <CartDrawer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/payment/success" element={<PaymentResult />} />
        <Route path="/payment/pending" element={<PaymentResult />} />
        <Route path="/payment/failed" element={<PaymentResult />} />
        <Route path="/track/:orderId" element={<Track />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRouter />
        <Toaster richColors position="top-right" />
      </AppProvider>
    </BrowserRouter>
  );
}
