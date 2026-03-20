import { useState, useEffect } from "react";
import { toast } from "sonner";
import { exclusiveAccessSignup } from "@/services/api";
import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { HowItWorks } from "./HowItWorks";
import { AppShowcase } from "./AppShowcase";
import { SocialProof } from "./SocialProof";
import { CtaSection } from "./CtaSection";
import { Footer } from "./Footer";
import { MobileStickyBar } from "./MobileStickyBar";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [screenshotTheme, setScreenshotTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  const handleExclusiveSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      await exclusiveAccessSignup(email.trim());
      setIsSignedUp(true);
      setEmail("");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Не удалось отправить запрос. Попробуйте позже.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formProps = {
    email,
    isSubmitting,
    isSignedUp,
    onEmailChange: setEmail,
    onSubmit: handleExclusiveSignup,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeroSection {...formProps} />
      <FeaturesSection />
      <HowItWorks />
      <AppShowcase
        screenshotTheme={screenshotTheme}
        onToggleTheme={() =>
          setScreenshotTheme((t) => (t === "dark" ? "light" : "dark"))
        }
      />
      <SocialProof />
      <CtaSection {...formProps} />
      <Footer />
      <MobileStickyBar {...formProps} />
    </div>
  );
}
