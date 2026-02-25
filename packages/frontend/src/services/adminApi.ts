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
