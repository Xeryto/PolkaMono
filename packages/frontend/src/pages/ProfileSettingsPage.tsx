import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast"; // NEW
import * as api from "@/services/api"; // NEW
import { BrandResponse, BrandProfileUpdateRequest } from "@/services/api"; // NEW
import { useAuth } from "@/context/AuthContext"; // Import useAuth

export function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { token } = useAuth(); // Get token from useAuth

  const [profile, setProfile] = useState<BrandResponse | null>(null); // Changed to BrandResponse
  const [isLoading, setIsLoading] = useState(true); // NEW
  const { toast } = useToast(); // NEW

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Authentication token not found. Please log in.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        const fetchedProfile = await api.getBrandProfile(token); // Pass token
        setProfile(fetchedProfile);
      } catch (error: any) {
        console.error("Failed to fetch brand profile:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load brand profile.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [token, toast]); // Add token and toast to dependency array

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setProfile(prev => prev ? { ...prev, [id]: value } : null);
  };

  const handleSave = async () => {
    if (!profile) return;

    setIsLoading(true);
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found. Please log in.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    try {
      const updatedProfile: BrandProfileUpdateRequest = {
        name: profile.name,
        email: profile.email,
        // password: profile.password, // Password should be handled separately for security
        slug: profile.slug,
        logo: profile.logo,
        description: profile.description,
        return_policy: profile.return_policy,
        min_free_shipping: profile.min_free_shipping,
        shipping_price: profile.shipping_price,
        shipping_provider: profile.shipping_provider,
      };
      const response = await api.updateBrandProfile(updatedProfile, token); // Pass token
      setProfile(response);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Brand profile updated successfully!",
      });
    } catch (error: any) {
      console.error("Failed to update brand profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update brand profile.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Profile Settings</h2>

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Brand Profile</CardTitle>
            <CardDescription>View and update your brand's information</CardDescription>
          </div>
          {!isEditing && <Button onClick={() => setIsEditing(true)}>Edit</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div>Loading profile...</div>
          ) : profile ? (
            isEditing ? (
              <>
                <div>
                  <label htmlFor="name" className="text-sm font-medium text-muted-foreground">Brand Name</label>
                  <Input id="name" value={profile.name} onChange={handleInputChange} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="email" className="text-sm font-medium text-muted-foreground">Contact Email</label>
                  <Input id="email" type="email" value={profile.email} onChange={handleInputChange} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="min_free_shipping" className="text-sm font-medium text-muted-foreground">Минимальная цена для бесплатной доставки</label>
                  <Input id="min_free_shipping" type="number" value={profile.min_free_shipping} onChange={handleInputChange} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="shipping_price" className="text-sm font-medium text-muted-foreground">Цена доставки</label>
                  <Input id="shipping_price" type="number" value={profile.shipping_price} onChange={handleInputChange} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="shipping_provider" className="text-sm font-medium text-muted-foreground">Фирма доставки</label>
                  <Input id="shipping_provider" value={profile.shipping_provider} onChange={handleInputChange} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="return_policy" className="text-sm font-medium text-muted-foreground">Политика возврата</label>
                  <Textarea id="return_policy" value={profile.return_policy} onChange={handleInputChange} className="mt-1" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>Cancel</Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Brand Name</p>
                  <p className="text-lg">{profile.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Email</p>
                  <p className="text-lg">{profile.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Минимальная цена для бесплатной доставки</p>
                  <p className="text-lg">{profile.min_free_shipping}₽</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Цена доставки</p>
                  <p className="text-lg">{profile.shipping_price}₽</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Фирма доставки</p>
                  <p className="text-lg">{profile.shipping_provider}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Политика возврата</p>
                  <p className="text-lg">{profile.return_policy}</p>
                </div>
              </div>
            )
          ) : (
            <div>No profile data available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
