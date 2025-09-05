import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api"; // Assuming API calls are here
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colors } from "@/lib/colors";
import { materials } from "@/lib/materials";
import { FileInput } from "@/components/ui/file-input";
import { sizes } from "@/lib/sizes";
import { CommandItem } from "@/components/ui/command";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description?: string;
    price: string;
    images: string[];
    honest_sign?: string;
    color?: string;
    material?: string;
    hashtags?: string[];
    brand_id: number;
    category_id: string;
    styles: string[];
    variants: { size: string; stock_quantity: number; }[];
    return_policy?: string; // NEW
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
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price);
  const [selectedColors, setSelectedColors] = useState<string[]>(product.color?.split(", ") || []);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(product.material ? product.material.split(", ").filter(m => m !== '') : []); // Changed to multi-select
  const [images, setImages] = useState<string[]>(product.images || []);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState(product.variants || []);
  const [returnPolicy, setReturnPolicy] = useState(product.return_policy || ''); // NEW
  const [sku, setSku] = useState(product.sku || ''); // NEW
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]); // Corrected state for MultiSelect
  const [styles, setStyles] = useState<any[]>([]);

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

  // Ensure state is updated if product prop changes (e.g., after a refresh)
  useEffect(() => {
    setName(product.name);
    setDescription(product.description || '');
    setPrice(product.price);
    setSelectedColors(product.color?.split(", ") || []);
    setSelectedMaterials(product.material?.split(", ") || []); // Update selected materials
    setImages(product.images || []);
    setVariants(product.variants || []);
    setReturnPolicy(product.return_policy || ''); // NEW
    setSku(product.sku || ''); // NEW
    // Initialize selectedStyles from product.styles
    setSelectedStyles(product.styles || []);
  }, [product]);

  // Fetch available styles when component mounts
  useEffect(() => {
    const fetchStyles = async () => {
      try {
        const fetchedStyles = await api.getStyles();
        setStyles(fetchedStyles);
      } catch (error) {
        console.error("Failed to fetch styles:", error);
        toast({
          title: "Error",
          description: "Failed to load styles.",
          variant: "destructive",
        });
      }
    };
    fetchStyles();
  }, []);

  const handleImageChange = (files: File[]) => {
    const newImages = [...images, ...files.map(file => URL.createObjectURL(file))];
    const newImageFiles = [...imageFiles, ...files];
    if (newImages.length > 5) {
      toast({
        title: "Error",
        description: "You can upload a maximum of 5 images.",
        variant: "destructive",
      });
      return;
    }
    setImages(newImages);
    setImageFiles(newImageFiles);
  };

  const handleRemoveImage = (imageToRemove: string) => {
    const imageIndex = images.findIndex(img => img === imageToRemove);
    if (imageIndex > -1) {
      const newImages = [...images];
      newImages.splice(imageIndex, 1);
      setImages(newImages);

      const newImageFiles = [...imageFiles];
      newImageFiles.splice(imageIndex, 1);
      setImageFiles(newImageFiles);
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

  const handleUpdateProduct = async () => {
    // Validate for duplicate sizes
    if (hasDuplicateSizes(variants)) {
      toast({
        title: "Error",
        description: "Duplicate sizes are not allowed for product variants.",
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
        images,
        color: selectedColors.join(", ") || undefined,
        material: selectedMaterials.join(", ") || undefined, // Changed to multi-select
        styles: selectedStyles, // Include selected styles
        variants: variants.filter(v => v.size.trim() && v.stock_quantity >= 0),
        return_policy: returnPolicy || undefined, // NEW
        sku: sku || undefined, // NEW
      };

      await api.updateProduct(product.id, updatedProductData);
      toast({
        title: "Success",
        description: "Product updated successfully!",
      });
      onProductUpdated(); // Notify parent to refresh
      onClose();
    } catch (error: any) {
      console.error("Failed to update product:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update product.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Details & Management</DialogTitle>
          <DialogDescription>
            Edit details and manage variants for {product.name}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Basic Details */}
          <div>
            <Label htmlFor="name">Название товара</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="price">Цена</Label>
            <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Цвет</Label>
            <MultiSelect
              options={colors.map(c => ({
                label: c.russian,
                value: c.name,
                hex: c.hex, // Include hex value
              }))}
              value={selectedColors}
              onValueChange={setSelectedColors}
              placeholder="Выберите цвета..."
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

          {/* Material */}
          <div>
            <Label htmlFor="materials">Материал</Label>
            <MultiSelect
              options={materials.map(materialOption => ({
                label: materialOption.russian,
                value: materialOption.name,
              }))}
              value={selectedMaterials}
              onValueChange={setSelectedMaterials}
              placeholder="Выберите материалы..."
              className="mt-1"
            />
          </div>

          {/* Return Policy */}
          <div>
            <Label htmlFor="returnPolicy">Политика возврата</Label>
            <Textarea id="returnPolicy" value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} className="mt-1" />
          </div>

          {/* SKU */}
          <div>
            <Label htmlFor="sku">Артикул товара (SKU)</Label>
            <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1" />
          </div>

          {/* Images */}
          <div>
            <Label htmlFor="images">Изображения (до 5)</Label>
            <FileInput
              id="images"
              multiple
              accept="image/*"
              onFilesChange={handleImageChange}
              selectedFileNames={imageFiles.map(file => file.name)}
              className="mt-1"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((imgUrl) => (
                <div key={imgUrl} className="relative">
                  <img src={imgUrl} alt="Product Image" className="w-20 h-20 object-cover rounded-md" />
                  <XCircle className="absolute -top-2 -right-2 h-4 w-4 text-red-500 cursor-pointer" onClick={() => handleRemoveImage(imgUrl)} />
                </div>
              ))}
            </div>
          </div>

          {/* Style Selection */}
          <div>
            <Label htmlFor="style">Стиль</Label>
            <MultiSelect
              options={styles.map(s => ({ label: s.name, value: s.id }))}
              value={selectedStyles}
              onValueChange={setSelectedStyles}
              placeholder="Выберите стили..."
            />
          </div>

          {/* Product Variants (Sizes & Quantities) */}
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
                  onChange={(e) => handleVariantChange(index, 'stock_quantity', parseInt(e.target.value))}
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleUpdateProduct} disabled={isLoading}>
            {isLoading ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};