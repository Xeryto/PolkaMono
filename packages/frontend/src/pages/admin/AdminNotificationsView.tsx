import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendAdminNotification } from "@/services/adminApi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Bell } from "lucide-react";

export function AdminNotificationsView() {
  const { token } = useAdminAuth();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim() || !token) return;
    setSending(true);
    setError(null);
    setSent(false);
    try {
      await sendAdminNotification(token, message.trim());
      setSent(true);
      setMessage("");
    } catch {
      setError("Failed to send notification.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="h-5 w-5 text-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Broadcast Notification</h2>
      </div>

      <div className="bg-card-custom/40 rounded-xl border border-brown-light/20 p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notif-message" className="text-sm font-medium text-foreground">
            Message to all brands
          </Label>
          <Textarea
            id="notif-message"
            placeholder="Enter notification text..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={4}
            className="resize-none bg-background/50 border-brown-light/30 text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {sent && <p className="text-sm text-green-500">Notification sent to all brands.</p>}

        <Button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full bg-foreground text-background hover:bg-foreground/90"
        >
          {sending ? "Sending..." : "Send to all brands"}
        </Button>
      </div>
    </div>
  );
}
