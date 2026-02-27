import { ENV_CONFIG } from "@/config/environment";

const API_URL = ENV_CONFIG.API_BASE_URL;

export interface AdminLoginResponse {
  token: string;
  expires_at: string;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_URL}/api/v1/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Login failed");
  }
  return res.json();
}

export async function sendAdminNotification(token: string, message: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/admin/notifications/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to send notification");
}

export async function sendAdminBuyerPush(token: string, message: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/admin/notifications/send-buyers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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

export async function getAdminReturns(token: string): Promise<AdminReturnItem[]> {
  const res = await fetch(`${API_URL}/api/v1/admin/returns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

export async function lookupAdminOrder(token: string, orderId: string): Promise<AdminOrderLookup> {
  const res = await fetch(
    `${API_URL}/api/v1/admin/orders/lookup?order_id=${encodeURIComponent(orderId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(res.status === 404 ? "Order not found" : "Lookup failed");
  return res.json();
}

export async function logAdminReturn(
  token: string,
  orderId: string,
  itemIds: string[]
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/admin/returns/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ order_id: orderId, item_ids: itemIds }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to log return");
}

// --- Withdrawal Management ---

export interface BrandSearchResult {
  id: string;
  name: string;
  amount_withdrawn: number;
}

export async function searchBrands(token: string, query: string): Promise<BrandSearchResult[]> {
  const res = await fetch(
    `${API_URL}/api/v1/admin/brands/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
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
  token: string,
  brandId: string,
  amount: number,
  note?: string
): Promise<{ id: string; amount: number }> {
  const res = await fetch(`${API_URL}/api/v1/admin/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ brand_id: brandId, amount, note: note || null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to record withdrawal");
  }
  return res.json();
}

export async function getWithdrawals(
  token: string,
  brandId?: string
): Promise<WithdrawalRecord[]> {
  const params = brandId ? `?brand_id=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`${API_URL}/api/v1/admin/withdrawals${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch withdrawals");
  const data = await res.json();
  return data.withdrawals;
}
