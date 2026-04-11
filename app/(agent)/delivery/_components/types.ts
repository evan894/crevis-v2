export type DeliveryStatus =
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery";

export type Product = {
  id: string;
  name: string;
  photo_url: string;
};

export type Order = {
  id: string;
  buyer_name: string;
  buyer_telegram_id: string;
  amount: number;
};

export type DeliveryRecord = {
  id: string;
  order_id: string;
  status: DeliveryStatus;
  otp: string | null;
  otp_attempts: number;
  packed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  agent_id: string | null;
  order: Order;
  product: Product | null;
};

export type AgentRole = "owner" | "manager" | "delivery_agent";

export const FAILURE_REASONS = [
  "Customer not available",
  "Wrong address",
  "Customer refused delivery",
  "Other",
];

export function relativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function roleBadgeStyle(role: AgentRole): string {
  switch (role) {
    case "owner":          return "bg-saffron/15 text-saffron";
    case "manager":        return "bg-blue-100 text-blue-700";
    case "delivery_agent": return "bg-purple-100 text-purple-700";
  }
}

export function roleLabel(role: AgentRole): string {
  switch (role) {
    case "owner":          return "Owner";
    case "manager":        return "Manager";
    case "delivery_agent": return "Delivery Agent";
  }
}
