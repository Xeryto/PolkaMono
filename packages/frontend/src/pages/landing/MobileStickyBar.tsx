import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

interface MobileStickyBarProps {
  email: string;
  isSubmitting: boolean;
  isSignedUp: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function MobileStickyBar({
  email,
  isSubmitting,
  isSignedUp,
  onEmailChange,
  onSubmit,
}: MobileStickyBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:hidden backdrop-blur-xl bg-background/70 border-t border-border/30 p-3 z-50">
      {isSignedUp ? (
        <div className="flex items-center gap-2 justify-center py-2">
          <Sparkles className="h-4 w-4 text-brand-dark" />
          <p className="text-sm text-brand-dark font-medium">Вы в списке!</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder="ваш@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            className="h-10 bg-input border-border/50 flex-1 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-10 px-4"
          >
            {isSubmitting ? "..." : "Записаться"}
          </Button>
        </form>
      )}
    </div>
  );
}
