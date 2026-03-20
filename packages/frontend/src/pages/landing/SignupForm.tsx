import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles } from "lucide-react";

interface SignupFormProps {
  id?: string;
  email: string;
  isSubmitting: boolean;
  isSignedUp: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SignupForm({
  id,
  email,
  isSubmitting,
  isSignedUp,
  onEmailChange,
  onSubmit,
}: SignupFormProps) {
  if (isSignedUp) {
    return (
      <div className="flex items-center gap-2 justify-center py-3 px-4 rounded-xl bg-brand/10 border border-brand/30">
        <Sparkles className="h-5 w-5 text-brand" />
        <p className="text-brand font-medium">
          Вы в списке! Мы скоро свяжемся.
        </p>
      </div>
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col sm:flex-row gap-3 w-full max-w-md"
      id={id}
    >
      <Input
        type="email"
        placeholder="ваш@email.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        required
        className="h-12 bg-input border-border/50 focus:border-brand text-foreground flex-1"
      />
      <Button
        type="submit"
        size="lg"
        className="h-12 px-6 whitespace-nowrap"
        disabled={isSubmitting}
      >
        {isSubmitting ? "..." : "Присоединиться"}
        {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </form>
  );
}
