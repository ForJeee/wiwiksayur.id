import axios from "axios";

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach bearer token if present in localStorage (fallback when cookies blocked)
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("session_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const formatRupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const API_URL = API_BASE;
