/**
 * Order status constants and helpers.
 * Canonical source: packages/api/models.py OrderStatus. API returns lowercase values.
 */
export const ORDER_STATUS = {
  CREATED: "created",
  PENDING: "pending",
  PAID: "paid",
  SHIPPED: "shipped",
  RETURNED: "returned",
  PARTIALLY_RETURNED: "partially_returned",
  CANCELED: "canceled",
} as const;

type OrderStatusValue = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

function normalize(status: string | undefined): OrderStatusValue | undefined {
  if (!status) return undefined;
  const s = String(status).toLowerCase();
  if (["created", "pending", "paid", "shipped", "returned", "partially_returned", "canceled"].includes(s))
    return s as OrderStatusValue;
  return undefined;
}

export function getOrderStatusLabel(status: string | undefined): string {
  const s = normalize(status);
  if (!s) return "неизвестно";
  const labels: Record<string, string> = {
    created: "создан",
    pending: "ожидание",
    paid: "оплачен",
    shipped: "отправлен",
    returned: "возвращён",
    partially_returned: "частично возвращён",
    canceled: "отменён",
  };
  return labels[s] ?? "неизвестно";
}

export function getOrderStatusColor(status: string | undefined): string {
  const s = normalize(status);
  if (!s) return "bg-gray-900/20 text-gray-300 border-gray-700/30";
  const colors: Record<string, string> = {
    created: "bg-slate-900/20 text-slate-300 border-slate-700/30",
    pending: "bg-yellow-900/20 text-yellow-300 border-yellow-700/30",
    paid: "bg-emerald-900/20 text-emerald-300 border-emerald-700/30",
    shipped: "bg-blue-900/20 text-blue-300 border-blue-700/30",
    returned: "bg-amber-900/20 text-amber-300 border-amber-700/30",
    partially_returned: "bg-orange-900/20 text-orange-300 border-orange-700/30",
    canceled: "bg-gray-900/20 text-gray-300 border-gray-700/30",
  };
  return colors[s] ?? "bg-gray-900/20 text-gray-300 border-gray-700/30";
}
