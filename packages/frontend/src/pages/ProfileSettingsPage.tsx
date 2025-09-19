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
  // Shopping information state
  const [shoppingInfo, setShoppingInfo] = useState<api.ShoppingInfo | null>(null);
  const [isLoadingShoppingInfo, setIsLoadingShoppingInfo] = useState(false);
  const [isSavingShoppingInfo, setIsSavingShoppingInfo] = useState(false);
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

  // Load shopping information
  useEffect(() => {
    const loadShoppingInfo = async () => {
      if (!token) return;
      
      try {
        setIsLoadingShoppingInfo(true);
        const info = await api.getShoppingInfo(token);
        setShoppingInfo(info);
      } catch (error: any) {
        console.error('Failed to load shopping information:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить информацию о доставке.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingShoppingInfo(false);
      }
    };

    loadShoppingInfo();
  }, [token, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    if (id === 'shipping_price' || id === 'min_free_shipping') {
      setProfile(prev => prev ? { ...prev, [id]: parseFloat(value) } : null);
    } else {
      setProfile(prev => prev ? { ...prev, [id]: value } : null);
    }
  };

  const handleShoppingInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setShoppingInfo(prev => prev ? { ...prev, [id]: value } : null);
  };

  const handleSaveShoppingInfo = async () => {
    if (!shoppingInfo || !token) return;

    try {
      setIsSavingShoppingInfo(true);
      await api.updateShoppingInfo(shoppingInfo, token);
      toast({
        title: "Успешно",
        description: "Информация о доставке сохранена.",
      });
    } catch (error: any) {
      console.error('Failed to save shopping information:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить информацию о доставке.",
        variant: "destructive",
      });
    } finally {
      setIsSavingShoppingInfo(false);
    }
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

      {/* Shopping Information Form */}
      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>Информация о доставке</CardTitle>
          <CardDescription>Управление данными для доставки заказов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingShoppingInfo ? (
            <div>Загрузка информации о доставке...</div>
          ) : shoppingInfo ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="full_name" className="text-sm font-medium text-muted-foreground">Полное имя для доставки *</label>
                  <Input 
                    id="full_name" 
                    value={shoppingInfo.full_name} 
                    onChange={handleShoppingInfoChange} 
                    className="mt-1" 
                    placeholder="Введите ваше полное имя для доставки"
                  />
                </div>
                <div>
                  <label htmlFor="delivery_email" className="text-sm font-medium text-muted-foreground">Email для доставки *</label>
                  <Input 
                    id="delivery_email" 
                    type="email" 
                    value={shoppingInfo.delivery_email} 
                    onChange={handleShoppingInfoChange} 
                    className="mt-1" 
                    placeholder="Введите email для доставки"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="text-sm font-medium text-muted-foreground">Телефон *</label>
                  <Input 
                    id="phone" 
                    value={shoppingInfo.phone} 
                    onChange={handleShoppingInfoChange} 
                    className="mt-1" 
                    placeholder="Введите ваш телефон"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="text-sm font-medium text-muted-foreground">Город *</label>
                  <Input 
                    id="city" 
                    value={shoppingInfo.city} 
                    onChange={handleShoppingInfoChange} 
                    className="mt-1" 
                    placeholder="Введите город"
                  />
                </div>
                <div>
                  <label htmlFor="postal_code" className="text-sm font-medium text-muted-foreground">Почтовый индекс</label>
                  <Input 
                    id="postal_code" 
                    value={shoppingInfo.postal_code} 
                    onChange={handleShoppingInfoChange} 
                    className="mt-1" 
                    placeholder="Введите почтовый индекс"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="address" className="text-sm font-medium text-muted-foreground">Адрес доставки *</label>
                <Textarea 
                  id="address" 
                  value={shoppingInfo.address} 
                  onChange={handleShoppingInfoChange} 
                  className="mt-1" 
                  placeholder="Введите полный адрес доставки"
                  rows={3}
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveShoppingInfo} 
                  disabled={isSavingShoppingInfo}
                >
                  {isSavingShoppingInfo ? "Сохранение..." : "Сохранить информацию о доставке"}
                </Button>
              </div>
            </>
          ) : (
            <div>Не удалось загрузить информацию о доставке.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
