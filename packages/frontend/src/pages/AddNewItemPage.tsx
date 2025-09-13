import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import * as api from "@/services/api"; // Assuming API calls are here
import { useToast } from "@/hooks/use-toast";
import { colors } from "@/lib/colors";
import { materials } from "@/lib/materials";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Keep Select for styles
import { FileInput } from "@/components/ui/file-input";
import { sizes } from "@/lib/sizes";
import { useAuth } from "@/context/AuthContext"; // Import useAuth

export function AddNewItemPage() {
  const [name, setName] = useState('');
  const { token } = useAuth(); // Get token from useAuth

  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]); // Changed to multi-select
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]); // Added for multi-select materials
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [styles, setStyles] = useState<any[]>([]); // State to store available styles
  const [selectedStyle, setSelectedStyle] = useState(''); // State for selected style
  const [categories, setCategories] = useState<any[]>([]); // State to store available categories
  const [selectedCategory, setSelectedCategory] = useState(''); // State for selected category
  const [variants, setVariants] = useState([{ size: '', stock_quantity: 0 }]); // For sizes and quantities
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
    // Fetch available styles and categories when component mounts
    const fetchData = async () => {
      try {
        const [fetchedStyles, fetchedCategories] = await Promise.all([
          api.getStyles(),
          api.getCategories()
        ]);
        setStyles(fetchedStyles);
        setCategories(fetchedCategories);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить стили и категории.",
          variant: "destructive",
        });
      }
    };
    fetchData();
  }, []);

  const handleImageChange = (files: File[]) => {
    const newImages = [...images, ...files.map(file => URL.createObjectURL(file))];
    const newImageFiles = [...imageFiles, ...files];
    if (newImages.length > 5) {
      toast({
        title: "Ошибка",
        description: "Вы можете загрузить максимум 5 изображений.",
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

  const handleSubmit = async () => {
    // Validate required fields
    if (!name.trim() || !price.trim() || !description.trim() || !selectedCategory) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните все обязательные поля, включая категорию.",
        variant: "destructive",
      });
      return;
    }

    // Validate for duplicate sizes
    if (hasDuplicateSizes(variants)) {
      toast({
        title: "Ошибка",
        description: "Дублирующиеся размеры не допускаются для вариантов товара.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!token) {
        toast({
          title: "Ошибка",
          description: "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
          variant: "destructive",
        });
        setIsLoading(false); // Stop loading if no token
        return;
      }

      const productData = {
        name,
        price: parseFloat(price),
        description,
        images,
        color: selectedColors.length > 0 ? selectedColors.join(", ") : undefined,
        material: selectedMaterials.length > 0 ? selectedMaterials.join(", ") : undefined,
        brand_id: 1, // Placeholder: Replace with actual brand ID from current user
        category_id: selectedCategory,
        styles: selectedStyle ? [selectedStyle] : [], // Send selected style
        variants: variants.filter(v => v.size.trim() && v.stock_quantity >= 0),
        sku: Math.random().toString(36).substring(2, 15),
      };

      await api.createProduct(productData, token); // Pass token
      toast({
        title: "Успех",
        description: "Товар успешно добавлен!",
      });
      // Clear form
      setName('');
      setPrice('');
      setDescription('');
      setSelectedColors([]); // Clear selected colors
      setSelectedMaterials([]); // Clear selected materials
      setImages([]);
      setImageFiles([]);
      setSelectedStyle('');
      setSelectedCategory('');
      setVariants([{ size: '', stock_quantity: 0 }]);
    } catch (error: any) {
      console.error("Failed to add product:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить товар.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Добавить новый товар</h2>

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>Детали товара</CardTitle>
          <CardDescription>Заполните детали нового товара</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Название товара</Label>
            <Input id="name" placeholder="напр., Элитное худи" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="price">Цена</Label>
            <Input id="price" type="number" placeholder="напр., 150.00" className="mt-1" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" placeholder="Краткое описание товара" className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Color */}
          <div>
            <Label htmlFor="colors">Цвет</Label>
            <MultiSelect
              options={colors.map(colorOption => ({
                label: colorOption.russian,
                value: colorOption.name,
                hex: colorOption.hex, // Include hex value
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
              placeholder="Выберите материалы"
              className="mt-1"
            />
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

          {/* Category Selection */}
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

          {/* Style Selection */}
          <div>
            <Label htmlFor="style">Стиль</Label>
            <Select onValueChange={setSelectedStyle} value={selectedStyle}>
              <SelectTrigger className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <SelectValue placeholder="Выберите стиль" className="text-muted-foreground" />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.id}>{style.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Добавление..." : "Добавить товар"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
