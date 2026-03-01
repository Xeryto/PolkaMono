import { ENV_CONFIG } from "@/config/environment";

const API_URL = ENV_CONFIG.API_BASE_URL;

async function adminApiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("adminToken");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    window.dispatchEvent(new Event("admin-auth-error"));
    throw new Error("Unauthorized");
  }
  return res;
}

export interface AdminLoginResponse {
  token: string;
  expires_at: string;
}

export interface AdminOtpResponse {
  otp_required: true;
  session_token: string;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse | AdminOtpResponse> {
  const res = await fetch(`${API_URL}/api/v1/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 202) {
    return res.json() as Promise<AdminOtpResponse>;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Login failed");
  }
  return res.json();
}

export async function adminVerifyOtp(sessionToken: string, code: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_URL}/api/v1/admin/auth/2fa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Verification failed");
  }
  return res.json();
}

export async function adminResendOtp(sessionToken: string): Promise<{ message: string; resends_remaining: number }> {
  const res = await fetch(`${API_URL}/api/v1/admin/auth/2fa/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Resend failed");
  }
  return res.json();
}

export async function sendAdminNotification(message: string): Promise<void> {
  const res = await adminApiRequest("/api/v1/admin/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to send notification");
}

export async function sendAdminBuyerPush(message: string): Promise<void> {
  const res = await adminApiRequest("/api/v1/admin/notifications/send-buyers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to send buyer push");
}

export interface AdminReturnItem {
  item_id: string;
  order_id: string;
  product_name: string;
  brand_name: string;
  returned_at: string | null;
}

export async function getAdminReturns(dateFrom?: string, dateTo?: string): Promise<AdminReturnItem[]> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  const res = await adminApiRequest(`/api/v1/admin/returns${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch returns");
  return res.json();
}

export interface AdminOrderItem {
  item_id: string;
  product_name: string;
  quantity: number;
  current_status: string;
}

export interface AdminOrderLookup {
  order_id: string;
  brand_name: string;
  items: AdminOrderItem[];
}

export async function lookupAdminOrder(orderId: string): Promise<AdminOrderLookup> {
  const res = await adminApiRequest(
    `/api/v1/admin/orders/lookup?order_id=${encodeURIComponent(orderId)}`
  );
  if (!res.ok) throw new Error(res.status === 404 ? "Order not found" : "Lookup failed");
  return res.json();
}

export async function logAdminReturn(orderId: string, itemIds: string[]): Promise<void> {
  const res = await adminApiRequest("/api/v1/admin/returns/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, item_ids: itemIds }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to log return");
}

// --- Order Export ---

export interface AdminOrderSummary {
  id: string;
  number: string;
  total_amount: number;
  currency?: string;
  date: string;
  status: string;
  tracking_number?: string;
  tracking_link?: string;
  shipping_cost?: number;
  brand_name: string;
}

export async function getAdminOrders(dateFrom?: string, dateTo?: string): Promise<AdminOrderSummary[]> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  const res = await adminApiRequest(`/api/v1/admin/orders${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

// --- Withdrawal Management ---

export interface BrandSearchResult {
  id: string;
  name: string;
  amount_withdrawn: number;
}

export async function searchBrands(query: string): Promise<BrandSearchResult[]> {
  const res = await adminApiRequest(
    `/api/v1/admin/brands/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error("Failed to search brands");
  return res.json();
}

export interface WithdrawalRecord {
  id: string;
  brand_id: string;
  brand_name: string;
  amount: number;
  note: string | null;
  admin_email: string;
  created_at: string;
}

export async function recordWithdrawal(
  brandId: string,
  amount: number,
  note?: string
): Promise<{ id: string; amount: number }> {
  const res = await adminApiRequest("/api/v1/admin/withdrawals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand_id: brandId, amount, note: note || null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to record withdrawal");
  }
  return res.json();
}

export async function getWithdrawals(brandId?: string, dateFrom?: string, dateTo?: string): Promise<WithdrawalRecord[]> {
  const params = new URLSearchParams();
  if (brandId) params.set("brand_id", brandId);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  const res = await adminApiRequest(`/api/v1/admin/withdrawals${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch withdrawals");
  const data = await res.json();
  return data.withdrawals;
}
