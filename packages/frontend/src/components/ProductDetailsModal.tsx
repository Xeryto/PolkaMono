import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api"; // Assuming API calls are here
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colors } from "@/lib/colors";
import { materials } from "@/lib/materials";
import { FileInput } from "@/components/ui/file-input";
import { sizes } from "@/lib/sizes";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { translateColorToRussian, translateMaterialToRussian } from "@/lib/translations";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    images: string[];
    color?: string;
    material?: string;
    brand_id: number;
    category_id: string;
    styles: string[];
    variants: { size: string; stock_quantity: number; }[];
    sku?: string; // NEW
  };
  onProductUpdated: () => void; // Callback to refresh product list
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
  onProductUpdated,
}) => {
  const { token } = useAuth(); // Get token from useAuth

  // Initialize states directly from product prop, they will be re-evaluated on product prop change
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price || 0);
  const [selectedColors, setSelectedColors] = useState<string[]>(product.color?.split(", ").filter(c => c) || []);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(product.material ? product.material.split(", ").filter(m => m) : []);
  const [images, setImages] = useState<string[]>(product.images || []);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [sku, setSku] = useState(product.sku || '');
  console.log(product);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(product.category_id || '');
  const [variants, setVariants] = useState(product.variants || []);

  // Helper function to check for duplicate sizes
  const hasDuplicateSizes = (variants: { size: string; stock_quantity: number }[]) => {
    const seenSizes = new Set<string>();
    for (const variant of variants) {
      if (variant.size.trim() === '') {
        continue; // Ignore empty sizes for duplicate check
      }
      if (seenSizes.has(variant.size)) {
        return true; // Duplicate found
      }
      seenSizes.add(variant.size);
    }
    return false; // No duplicates
  };

  useEffect(() => {
    setName(product.name);
    setDescription(product.description || '');
    setPrice(product.price || 0);
    setSelectedColors(product.color?.split(", ").filter(c => c) || []);
    setSelectedMaterials(product.material ? product.material.split(", ").filter(m => m) : []);
    setImages(product.images || []);
    setSku(product.sku || '');
    setSelectedStyles(product.styles || []);
    setVariants(product.variants || []);
  }, [product]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedStyles, fetchedCategories] = await Promise.all([
          api.getStyles(),
          api.getCategories()
        ]);
        setStyles(fetchedStyles);
        setCategories(fetchedCategories);
      } catch (error) {
        toast({
          title: "Error fetching data",
          description: "Could not fetch styles and categories. Please try again later.",
          variant: "destructive",
        });
      }
    };
    fetchData();

    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [toast, imagePreviews]);

  const handleSave = async () => {
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update a product.",
        variant: "destructive",
      });
      return;
    }

    if (hasDuplicateSizes(variants)) {
      toast({
        title: "Invalid Variants",
        description: "Duplicate sizes are not allowed.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const updatedProductData = {
        name,
        description,
        price,
        color: selectedColors.join(", "),
        material: selectedMaterials.join(", "),
        styles: selectedStyles,
        category_id: selectedCategory,
        sku,
        variants,
        images, // Send the updated list of existing images
      };

      await api.updateProduct(product.id, updatedProductData, token);

      if (imageFiles.length > 0) {
        const formData = new FormData();
        imageFiles.forEach(file => {
          formData.append("files", file);
        });
        await api.uploadProductImages(product.id, formData, token);
      }

      toast({
        title: "Product Updated",
        description: "The product has been updated successfully.",
      });
      onProductUpdated();
      onClose();
    } catch (error) {
      toast({
        title: "Error updating product",
        description: "Could not update product. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVariantChange = (index: number, field: string, value: string | number) => {
    const newVariants = [...variants];
    (newVariants[index] as any)[field] = value;
    setVariants(newVariants);
  };

  const handleAddVariant = () => {
    setVariants([...variants, { size: '', stock_quantity: 0 }]);
  };

  const handleRemoveVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <Card className="bg-card border-0 shadow-none">
          <CardHeader>
            <CardTitle>Редактировать товар</CardTitle>
            <CardDescription>Внесите изменения в детали вашего товара</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Название товара</Label>
                  <Input id="name" placeholder="напр., Элитное худи" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="price">Цена</Label>
                  <Input id="price" type="number" placeholder="напр., 150.00" className="mt-1" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea id="description" placeholder="Краткое описание товара" className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="colors">Цвет</Label>
                  <MultiSelect
                    options={colors.map(colorOption => ({
                      label: colorOption.russian,
                      value: colorOption.name,
                      hex: colorOption.hex,
                    }))}
                    value={selectedColors}
                    onValueChange={setSelectedColors}
                    placeholder="Выберите цвета"
                    className="mt-1"
                    renderOption={(option) => (
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2 border"
                          style={{ background: option.hex }}
                        ></div>
                        {option.label}
                      </div>
                    )}
                    renderBadge={(option) => (
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-1 border"
                          style={{ background: option.hex }}
                        ></div>
                        {option.label}
                      </div>
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="materials">Материал</Label>
                  <MultiSelect
                    options={materials.map(materialOption => ({
                      label: materialOption.russian,
                      value: materialOption.name,
                    }))}
                    value={selectedMaterials}
                    onValueChange={setSelectedMaterials}
                    placeholder="Выберите материалы"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sku">Артикул товара (SKU)</Label>
                  <Input id="sku" placeholder="Например, NIKE-AM270-WHI-001" className="mt-1" value={sku} disabled />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="images">Изображения (до 5)</Label>
                  <FileInput
                    id="images"
                    multiple
                    accept="image/*"
                    onFilesChange={(files) => {
                      if ((images.length + imagePreviews.length + files.length) > 5) {
                        toast({ title: "Error", description: "You can upload a maximum of 5 images.", variant: "destructive" });
                        return;
                      }
                      const newImageFiles = [...imageFiles, ...files];
                      const newImagePreviews = [...imagePreviews, ...files.map(file => URL.createObjectURL(file))];
                      setImageFiles(newImageFiles);
                      setImagePreviews(newImagePreviews);
                    }}
                    selectedFileNames={imageFiles.map(file => file.name)}
                    className="mt-1"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((imgUrl, index) => (
                      <div key={`existing-${index}`} className="relative w-20 h-20">
                        <img src={imgUrl} alt="Product Image" className="w-full h-full object-cover rounded-md" />
                        <XCircle className="absolute -top-2 -right-2 h-4 w-4 text-red-500 cursor-pointer" onClick={() => setImages(images.filter((_, i) => i !== index))} />
                      </div>
                    ))}
                    {imagePreviews.map((imgUrl, index) => (
                      <div key={`new-${index}`} className="relative w-20 h-20">
                        <img src={imgUrl} alt="New Product Image" className="w-full h-full object-cover rounded-md" />
                        <XCircle className="absolute -top-2 -right-2 h-4 w-4 text-red-500 cursor-pointer" onClick={() => {
                          const newImageFiles = imageFiles.filter((_, i) => i !== index);
                          const newImagePreviews = imagePreviews.filter((_, i) => i !== index);
                          setImageFiles(newImageFiles);
                          setImagePreviews(newImagePreviews);
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="category">Категория *</Label>
                  <Select onValueChange={setSelectedCategory} value={selectedCategory}>
                    <SelectTrigger className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <SelectValue placeholder="Выберите категорию" className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Размеры и количество</Label>
                  {variants.map((variant, index) => (
                    <div key={index} className="flex space-x-2 mt-1">
                      <Select
                        onValueChange={(value) => handleVariantChange(index, 'size', value)}
                        value={variant.size}
                      >
                        <SelectTrigger className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                          <SelectValue placeholder="Выберите размер" />
                        </SelectTrigger>
                        <SelectContent>
                          {sizes.map((s) => (
                            <SelectItem key={s.name} value={s.name}>
                              {s.russian}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Количество"
                        value={variant.stock_quantity}
                        min="0"
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          if (value >= 0) {
                            handleVariantChange(index, 'stock_quantity', value);
                          }
                        }}
                        className="w-24"
                      />
                      <Button type="button" onClick={() => handleRemoveVariant(index)} variant="outline" size="icon">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" onClick={handleAddVariant} variant="outline" className="mt-2">
                    <PlusCircle className="h-4 w-4 mr-2" /> Добавить размер
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>Отмена</Button>
              <Button size="lg" onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};