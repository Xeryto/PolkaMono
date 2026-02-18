/**
 * Order status constants and helpers.
 * Canonical source: packages/api/models.py OrderStatus. API returns lowercase values.
 */
export const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  SHIPPED: "shipped",
  RETURNED: "returned",
  CANCELED: "canceled",
} as const;

type OrderStatusValue = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

function normalize(status: string | undefined): OrderStatusValue | undefined {
  if (!status) return undefined;
  const s = String(status).toLowerCase();
  if (["pending", "paid", "shipped", "returned", "canceled"].includes(s))
    return s as OrderStatusValue;
  return undefined;
}

export function getOrderStatusLabel(status: string | undefined): string {
  const s = normalize(status);
  if (!s) return "неизвестно";
  const labels: Record<string, string> = {
    pending: "ожидание",
    paid: "оплачен",
    shipped: "отправлен",
    returned: "возвращён",
    canceled: "отменён",
  };
  return labels[s] ?? "неизвестно";
}

export function getOrderStatusColor(status: string | undefined): string {
  const s = normalize(status);
  if (!s) return "bg-gray-900/20 text-gray-300 border-gray-700/30";
  const colors: Record<string, string> = {
    pending: "bg-yellow-900/20 text-yellow-300 border-yellow-700/30",
    paid: "bg-emerald-900/20 text-emerald-300 border-emerald-700/30",
    shipped: "bg-blue-900/20 text-blue-300 border-blue-700/30",
    returned: "bg-amber-900/20 text-amber-300 border-amber-700/30",
    canceled: "bg-gray-900/20 text-gray-300 border-gray-700/30",
  };
  return colors[s] ?? "bg-gray-900/20 text-gray-300 border-gray-700/30";
}
