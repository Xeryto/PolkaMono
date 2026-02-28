import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendAdminNotification, sendAdminBuyerPush } from "@/services/adminApi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Bell } from "lucide-react";

type Tab = "brands" | "buyers";

export function AdminNotificationsView() {
  const { token } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>("brands");

  // Brands tab state
  const [brandMessage, setBrandMessage] = useState("");
  const [brandSending, setBrandSending] = useState(false);
  const [brandSent, setBrandSent] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  // Buyers tab state
  const [buyerMessage, setBuyerMessage] = useState("");
  const [buyerSending, setBuyerSending] = useState(false);
  const [buyerSent, setBuyerSent] = useState(false);
  const [buyerError, setBuyerError] = useState<string | null>(null);

  const handleSendBrands = async () => {
    if (!brandMessage.trim() || !token) return;
    setBrandSending(true);
    setBrandError(null);
    setBrandSent(false);
    try {
      await sendAdminNotification(token, brandMessage.trim());
      setBrandSent(true);
      setBrandMessage("");
    } catch {
      setBrandError("Failed to send notification.");
    } finally {
      setBrandSending(false);
    }
  };

  const handleSendBuyers = async () => {
    if (!buyerMessage.trim() || !token) return;
    setBuyerSending(true);
    setBuyerError(null);
    setBuyerSent(false);
    try {
      await sendAdminBuyerPush(token, buyerMessage.trim());
      setBuyerSent(true);
      setBuyerMessage("");
    } catch {
      setBuyerError("Не удалось отправить push.");
    } finally {
      setBuyerSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="h-5 w-5 text-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Broadcast Notification</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab("brands")}
          className={
            activeTab === "brands"
              ? "px-4 py-1.5 rounded-lg text-sm bg-foreground/10 text-foreground font-medium"
              : "px-4 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          }
        >
          Бренды
        </button>
        <button
          onClick={() => setActiveTab("buyers")}
          className={
            activeTab === "buyers"
              ? "px-4 py-1.5 rounded-lg text-sm bg-foreground/10 text-foreground font-medium"
              : "px-4 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          }
        >
          Покупатели
        </button>
      </div>

      {/* Brands tab */}
      {activeTab === "brands" && (
        <div className="bg-card rounded-xl border border-border/30 p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-notif-message" className="text-sm font-medium text-foreground">
              Message to all brands
            </Label>
            <Textarea
              id="brand-notif-message"
              placeholder="Enter notification text..."
              value={brandMessage}
              onChange={(e) => setBrandMessage(e.target.value)}
              maxLength={500}
              rows={4}
              className="resize-none bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground text-right">{brandMessage.length}/500</p>
          </div>

          {brandError && <p className="text-sm text-red-500">{brandError}</p>}
          {brandSent && <p className="text-sm text-green-500">Notification sent to all brands.</p>}

          <Button
            onClick={handleSendBrands}
            disabled={brandSending || !brandMessage.trim()}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {brandSending ? "Sending..." : "Send to all brands"}
          </Button>
        </div>
      )}

      {/* Buyers tab */}
      {activeTab === "buyers" && (
        <div className="bg-card rounded-xl border border-border/30 p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyer-notif-message" className="text-sm font-medium text-foreground">
              Push-уведомление всем покупателям
            </Label>
            <Textarea
              id="buyer-notif-message"
              placeholder="Текст push-уведомления..."
              value={buyerMessage}
              onChange={(e) => setBuyerMessage(e.target.value)}
              maxLength={500}
              rows={4}
              className="resize-none bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground text-right">{buyerMessage.length}/500</p>
          </div>

          {buyerError && <p className="text-sm text-red-500">{buyerError}</p>}
          {buyerSent && <p className="text-sm text-green-500">Push отправлен всем активным покупателям.</p>}

          <Button
            onClick={handleSendBuyers}
            disabled={buyerSending || !buyerMessage.trim()}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {buyerSending ? "Sending..." : "Отправить покупателям"}
          </Button>
        </div>
      )}
    </div>
  );
}
