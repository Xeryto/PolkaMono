import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Shield } from "lucide-react";
import * as api from "@/services/api"; // NEW
import { BrandLoginRequest } from "@/services/api"; // NEW

const Portal = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const credentials: BrandLoginRequest = { email, password };
      await api.brandLogin(credentials);
      window.location.href = "/dashboard"; // Redirect on success
    } catch (error: any) {
      console.error("Brand login failed:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-ominous flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/assets/Logo.svg" alt="Polka Logo" className="mx-auto h-20 w-20" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Polka Brand Portal</h1>
          <p className="text-muted-foreground">Restricted Access Zone</p>
        </div>

        <Card className="bg-card/90 backdrop-blur border-brown-light/30 shadow-ominous">
          <CardHeader>
            <CardTitle className="text-center">Secure Access</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access the portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Brand Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 border-brown-light/30 focus:border-brown-light"
                />
              </div>
              
              <div>
                <Input
                  type="password"
                  placeholder="Access Code"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50 border-brown-light/30 focus:border-brown-light"
                />
              </div>
              
              <Button 
                type="submit" 
                variant="ominous" 
                size="lg" 
                className="w-full"
                disabled={isSubmitting}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {isSubmitting ? "Authenticating..." : "Access Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Вернуться на главный сайт
          </a>
        </div>
      </div>
    </div>
  );
};

export default Portal;