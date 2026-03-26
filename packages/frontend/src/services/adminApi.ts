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

export async function adminVerifyToken(): Promise<boolean> {
  const token = localStorage.getItem("adminToken");
  if (!token) return false;
  try {
    const res = await adminApiRequest("/api/v1/admin/auth/verify");
    return res.ok;
  } catch {
    return false;
  }
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
  if (!res.ok && res.status !== 204) throw new Error("Не удалось отправить уведомление");
}

export async function sendAdminBuyerPush(message: string): Promise<void> {
  const res = await adminApiRequest("/api/v1/admin/notifications/send-buyers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Не удалось отправить пуш покупателям");
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
  if (!res.ok) throw new Error("Не удалось загрузить список возвратов");
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
  if (!res.ok) throw new Error(res.status === 404 ? "Заказ не найден" : "Не удалось найти заказ");
  return res.json();
}

export async function logAdminReturn(orderId: string, itemIds: string[]): Promise<void> {
  const res = await adminApiRequest("/api/v1/admin/returns/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, item_ids: itemIds }),
  });
  if (!res.ok && res.status !== 204) throw new Error("Не удалось зафиксировать возврат");
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
  if (!res.ok) throw new Error("Не удалось загрузить список заказов");
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
  if (!res.ok) throw new Error("Не удалось найти бренды");
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
    throw new Error(data.detail || "Не удалось зафиксировать выплату");
  }
  return res.json();
}

// --- Brand Management ---

export interface AdminBrandListItem {
  id: string;
  name: string;
  email: string;
  slug: string;
  is_inactive: boolean;
  created_at: string | null;
}

export interface AdminBrandDetailResponse {
  id: string;
  name: string;
  email: string;
  slug: string;
  logo: string | null;
  description: string | null;
  return_policy: string | null;
  min_free_shipping: number | null;
  shipping_price: number | null;
  shipping_provider: string | null;
  amount_withdrawn: number;
  inn: string | null;
  official_name: string | null;
  contact_phone: string | null;
  tax_system: string | null;
  vat_payer: boolean | null;
  vat_rate: string | null;
  kpp: string | null;
  ogrn: string | null;
  registration_address: string | null;
  payout_account: string | null;
  delivery_time_min: number | null;
  delivery_time_max: number | null;
  is_inactive: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminBrandUpdatePayload {
  name?: string;
  email?: string;
  official_name?: string;
  contact_phone?: string;
  inn?: string;
  registration_address?: string;
  payout_account?: string;
  tax_system?: string;
  vat_payer?: boolean;
  vat_rate?: string;
  kpp?: string;
  ogrn?: string;
}

export interface AdminBrandCreatePayload {
  name: string;
  email: string;
  official_name: string;
  contact_phone: string;
  inn: string;
  tax_system: string;
  vat_payer: boolean;
  vat_rate?: string;
  kpp?: string;
  ogrn: string;
  registration_address: string;
  payout_account: string;
}

export interface AdminBrandCreateResponse {
  id: string;
  name: string;
  email: string;
  slug: string;
  temporary_password: string;
  is_inactive: boolean;
}

export async function getAdminBrands(): Promise<AdminBrandListItem[]> {
  const res = await adminApiRequest("/api/v1/admin/brands");
  if (!res.ok) throw new Error("Не удалось загрузить список брендов");
  return res.json();
}

export async function getAdminBrand(brandId: string): Promise<AdminBrandDetailResponse> {
  const res = await adminApiRequest(`/api/v1/admin/brands/${brandId}`);
  if (!res.ok) throw new Error("Не удалось загрузить данные бренда");
  return res.json();
}

export async function createAdminBrand(payload: AdminBrandCreatePayload): Promise<AdminBrandCreateResponse> {
  const res = await adminApiRequest("/api/v1/admin/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Не удалось создать бренд");
  }
  return res.json();
}

export async function updateAdminBrand(brandId: string, updates: AdminBrandUpdatePayload): Promise<AdminBrandDetailResponse> {
  const res = await adminApiRequest(`/api/v1/admin/brands/${brandId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Не удалось обновить данные бренда");
  }
  return res.json();
}

export async function activateAdminBrand(brandId: string): Promise<void> {
  const res = await adminApiRequest(`/api/v1/admin/brands/${brandId}/activate`, { method: "PUT" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Не удалось активировать бренд");
  }
}

export async function deactivateAdminBrand(brandId: string): Promise<void> {
  const res = await adminApiRequest(`/api/v1/admin/brands/${brandId}/deactivate`, { method: "PUT" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Не удалось деактивировать бренд");
  }
}

export async function getWithdrawals(brandId?: string, dateFrom?: string, dateTo?: string): Promise<WithdrawalRecord[]> {
  const params = new URLSearchParams();
  if (brandId) params.set("brand_id", brandId);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  const res = await adminApiRequest(`/api/v1/admin/withdrawals${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Не удалось загрузить список выплат");
  const data = await res.json();
  return data.withdrawals;
}
