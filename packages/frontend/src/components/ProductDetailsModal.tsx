import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api"; // Assuming API calls are here
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { colors } from "@/lib/colors";
import { materials } from "@/lib/materials";
import { FileInput } from "@/components/ui/file-input";
import { sizes } from "@/lib/sizes";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { formatCurrency } from "@/lib/currency";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: api.ProductResponse;
  onProductUpdated: () => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
  onProductUpdated,
}) => {
  const { token } = useAuth(); // Get token from useAuth

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(product.price || 0);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(
    product.material ? product.material.split(", ").filter((m) => m) : []
  );
  const [colorVariations, setColorVariations] = useState<api.ProductColorVariantSchema[]>(
    product.color_variants?.length ? product.color_variants : [{ color_name: "", color_hex: "#808080", images: [], variants: [] }]
  );
  const [colorVariationFiles, setColorVariationFiles] = useState<File[][]>(
    product.color_variants?.map(() => []) || [[]]
  );
  const [generalImages, setGeneralImages] = useState<string[]>(product.general_images || []);
  const [generalImageFiles, setGeneralImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [selectedStyles, setSelectedStyles] = useState<string[]>(product.styles || []);
  const [styles, setStyles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(product.category_id || "");

  const hasDuplicateSizes = (variants: { size: string; stock_quantity: number }[]) => {
    const seen = new Set<string>();
    for (const v of variants) {
      if (!v.size.trim()) continue;
      if (seen.has(v.size)) return true;
      seen.add(v.size);
    }
    return false;
  };

  useEffect(() => {
    setName(product.name);
    setDescription(product.description || "");
    setPrice(product.price || 0);
    setSelectedMaterials(product.material ? product.material.split(", ").filter((m) => m) : []);
    setSelectedStyles(product.styles || []);
    setSelectedCategory(product.category_id || "");
    setColorVariations(
      product.color_variants?.length ? product.color_variants : [{ color_name: "", color_hex: "#808080", images: [], variants: [] }]
    );
    setColorVariationFiles(product.color_variants?.map(() => []) || [[]]);
    setGeneralImages(product.general_images || []);
    setGeneralImageFiles([]);
  }, [product]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedStyles, fetchedCategories] = await Promise.all([
          api.getStyles(),
          api.getCategories(),
        ]);
        setStyles(fetchedStyles);
        setCategories(fetchedCategories);
      } catch (error) {
        toast({
          title: "Error fetching data",
          description: "Could not fetch styles and categories.",
          variant: "destructive",
        });
      }
    };
    fetchData();
  }, [toast]);

  const handleSave = async () => {
    if (!token) {
      toast({
        title: "Ошибка",
        description: "Войдите в систему для сохранения.",
        variant: "destructive",
      });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Ошибка", description: "Заполните название товара.", variant: "destructive" });
      return;
    }
    if (typeof price !== "number" || price < 0) {
      toast({ title: "Ошибка", description: "Цена не может быть отрицательной.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Ошибка", description: "Заполните описание.", variant: "destructive" });
      return;
    }
    if (!selectedCategory) {
      toast({ title: "Ошибка", description: "Выберите категорию.", variant: "destructive" });
      return;
    }
    for (const cv of colorVariations) {
      if (!(cv.color_name || "").trim()) {
        toast({
          title: "Ошибка",
          description: "У каждого варианта должен быть выбран цвет.",
          variant: "destructive",
        });
        return;
      }
      if (hasDuplicateSizes(cv.variants || [])) {
        toast({
          title: "Ошибка",
          description: `Дублирующиеся размеры в цвете "${cv.color_name}".`,
          variant: "destructive",
        });
        return;
      }
      for (const v of cv.variants || []) {
        const q = v.stock_quantity;
        if (v.size?.trim() && (typeof q !== "number" || q < 0 || !Number.isInteger(q))) {
          toast({
            title: "Ошибка",
            description: `Количество не может быть отрицательным (цвет "${cv.color_name}").`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const existingGeneralUrls = (generalImages || []).filter((u) => u.startsWith("http"));
    const newGeneralCount = generalImageFiles?.length ?? 0;
    const totalGeneral = existingGeneralUrls.length + newGeneralCount;
    const totalPerColor = colorVariations.map(
      (cv, i) => (cv.images || []).filter((u: string) => u.startsWith("http")).length + (colorVariationFiles?.[i]?.length ?? 0)
    );
    const hasGeneral = totalGeneral > 0;
    const hasAtLeastOnePerColor = totalPerColor.length > 0 && totalPerColor.every((n) => n > 0);
    if (!hasGeneral && !hasAtLeastOnePerColor) {
      toast({
        title: "Ошибка",
        description: "Нужно хотя бы одно общее изображение или хотя бы одно изображение в каждом цвете.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const uploadOne = async (file: File): Promise<string> => {
        const contentType = file.type || "image/jpeg";
        const { upload_url, public_url } = await api.getProductImagePresignedUrl(
          contentType,
          token!,
          file.name
        );
        await api.uploadFileToPresignedUrl(file, upload_url, contentType);
        return public_url;
      };

      const existingGeneralUrls = (generalImages || []).filter((u) =>
        u.startsWith("http")
      );
      const newGeneralUrls =
        generalImageFiles.length > 0
          ? await Promise.all(generalImageFiles.map(uploadOne))
          : [];
      const finalGeneralImages =
        existingGeneralUrls.length + newGeneralUrls.length > 0
          ? [...existingGeneralUrls, ...newGeneralUrls]
          : undefined;

      const colorVariantsWithUrls = await Promise.all(
        colorVariations.map(async (cv, i) => {
          const existingUrls = (cv.images || []).filter((u) =>
            u.startsWith("http")
          );
          const newFiles = colorVariationFiles[i] || [];
          const newUrls =
            newFiles.length > 0
              ? await Promise.all(newFiles.map(uploadOne))
              : [];
          return {
            color_name: cv.color_name,
            color_hex: cv.color_hex,
            images: [...existingUrls, ...newUrls],
            variants: (cv.variants || []).filter(
              (v) => v.size.trim() && v.stock_quantity >= 0
            ),
          };
        })
      );

      await api.updateProduct(
        product.id,
        {
          name,
          description,
          price,
          material: selectedMaterials.join(", ") || undefined,
          styles: selectedStyles,
          category_id: selectedCategory,
          color_variants: colorVariantsWithUrls,
          general_images: finalGeneralImages,
        },
        token!
      );
      toast({
        title: "Успех",
        description: "Товар обновлен.",
      });
      onProductUpdated();
      onClose();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить товар.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateColorVariation = (colorIndex: number, upd: Partial<api.ProductColorVariantSchema>) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = { ...next[colorIndex], ...upd };
      return next;
    });
  };

  const handleVariantChange = (colorIndex: number, variantIndex: number, field: string, value: string | number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      const vars = [...(next[colorIndex].variants || [])];
      (vars[variantIndex] as any)[field] = value;
      next[colorIndex] = { ...next[colorIndex], variants: vars };
      return next;
    });
  };

  const handleAddVariant = (colorIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      const vars = [...(next[colorIndex].variants || []), { size: "", stock_quantity: 0 }];
      next[colorIndex] = { ...next[colorIndex], variants: vars };
      return next;
    });
  };

  const handleRemoveVariant = (colorIndex: number, variantIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = {
        ...next[colorIndex],
        variants: (next[colorIndex].variants || []).filter((_, i) => i !== variantIndex),
      };
      return next;
    });
  };

  const handleColorSelect = (colorIndex: number, colorName: string) => {
    const c = colors.find((x) => x.name === colorName);
    if (c) updateColorVariation(colorIndex, { color_name: c.name, color_hex: c.hex });
  };

  const handleAddColorVariation = () => {
    setColorVariations((prev) => [
      ...prev,
      { color_name: "", color_hex: "#808080", images: [], variants: [] },
    ]);
    setColorVariationFiles((prev) => [...prev, []]);
  };

  const handleRemoveColorVariation = (colorIndex: number) => {
    if (colorVariations.length <= 1) {
      toast({
        title: "Ошибка",
        description: "Должен остаться хотя бы один цвет.",
        variant: "destructive",
      });
      return;
    }
    setColorVariations((prev) => prev.filter((_, i) => i !== colorIndex));
    setColorVariationFiles((prev) => prev.filter((_, i) => i !== colorIndex));
  };

  const handleColorVariationImages = (colorIndex: number, files: File[]) => {
    const newUrls = files.map((f) => URL.createObjectURL(f));
    const prev = colorVariations[colorIndex];
    if ((prev.images?.length || 0) + newUrls.length > 5) {
      toast({
        title: "Ошибка",
        description: "Максимум 5 изображений на цвет.",
        variant: "destructive",
      });
      return;
    }
    updateColorVariation(colorIndex, {
      images: [...(prev.images || []), ...newUrls],
    });
    setColorVariationFiles((prev) => {
      const next = [...prev];
      next[colorIndex] = [...(next[colorIndex] || []), ...files];
      return next;
    });
  };

  const removeColorVariationImage = (colorIndex: number, imageIndex: number) => {
    const prev = colorVariations[colorIndex];
    const newImages = (prev.images || []).filter((_, i) => i !== imageIndex);
    updateColorVariation(colorIndex, { images: newImages });
    setColorVariationFiles((prev) => {
      const next = [...prev];
      next[colorIndex] = (next[colorIndex] || []).filter((_, i) => i !== imageIndex);
      return next;
    });
  };

  const handleGeneralImages = (files: File[]) => {
    const newUrls = files.map((f) => URL.createObjectURL(f));
    if (generalImages.length + newUrls.length > 5) {
      toast({
        title: "Ошибка",
        description: "Максимум 5 общих изображений.",
        variant: "destructive",
      });
      return;
    }
    setGeneralImages((prev) => [...prev, ...newUrls]);
    setGeneralImageFiles((prev) => [...prev, ...files]);
  };

  const removeGeneralImage = (index: number) => {
    setGeneralImages((prev) => prev.filter((_, i) => i !== index));
    setGeneralImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <Card className="bg-card-custom border-0 shadow-none">
          <CardHeader>
            <CardTitle>Редактировать товар</CardTitle>
            <CardDescription>
              Внесите изменения в детали вашего товара
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="article_number">Артикул</Label>
                  <Input
                    id="article_number"
                    placeholder="Автоматически присвоен при создании"
                    className="mt-1 bg-muted cursor-not-allowed"
                    value={product.article_number || "Не присвоен"}
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Артикул автоматически генерируется системой и не может быть изменен
                  </p>
                </div>
                <div>
                  <Label htmlFor="name">Название товара</Label>
                  <Input
                    id="name"
                    placeholder="напр., Элитное худи"
                    className="mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="price">Цена</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="напр., 150.00"
                    className="mt-1"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    placeholder="Краткое описание товара"
                    className="mt-1"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="materials">Материал</Label>
                  <MultiSelect
                    options={materials.map((materialOption) => ({
                      label: materialOption.russian,
                      value: materialOption.name,
                    }))}
                    value={selectedMaterials}
                    onValueChange={setSelectedMaterials}
                    placeholder="Выберите материалы"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="category">Категория *</Label>
                  <Select
                    onValueChange={setSelectedCategory}
                    value={selectedCategory}
                  >
                    <SelectTrigger className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <SelectValue
                        placeholder="Выберите категорию"
                        className="text-muted-foreground"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Общие изображения (до 5)</Label>
                  <p className="text-xs text-muted-foreground">Для всех цветов</p>
                  <FileInput
                    multiple
                    accept="image/*"
                    onFilesChange={(files) => handleGeneralImages(files)}
                    selectedFileNames={generalImageFiles.map((f) => f.name)}
                    className="mt-1"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {generalImages.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-md" />
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 h-4 w-4 text-red-500"
                          onClick={() => removeGeneralImage(i)}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Варианты по цветам</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddColorVariation}>
                      <PlusCircle className="h-4 w-4 mr-1" /> Добавить цвет
                    </Button>
                  </div>
                  {colorVariations.map((cv, colorIndex) => (
                    <Card key={colorIndex} className="p-3 border border-border/50">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full border"
                            style={{ background: cv.color_hex?.startsWith("#") ? cv.color_hex : "#808080" }}
                          />
                          <Select
                            value={cv.color_name || ""}
                            onValueChange={(v) => handleColorSelect(colorIndex, v)}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="Цвет" />
                            </SelectTrigger>
                            <SelectContent>
                              {colors.map((c) => (
                                <SelectItem key={c.name} value={c.name}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full border"
                                      style={{ background: c.hex?.startsWith("#") ? c.hex : "#808080" }}
                                    />
                                    {c.russian}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveColorVariation(colorIndex)}
                          disabled={colorVariations.length <= 1}
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Изображения (до 5)</Label>
                        <FileInput
                          multiple
                          accept="image/*"
                          onFilesChange={(files) => handleColorVariationImages(colorIndex, files)}
                          selectedFileNames={(colorVariationFiles[colorIndex] || []).map((f) => f.name)}
                          className="mt-1"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(cv.images || []).map((url, imgIdx) => (
                            <div key={imgIdx} className="relative">
                              <img src={url} alt="" className="w-20 h-20 object-cover rounded-md" />
                              <button
                                type="button"
                                className="absolute -top-2 -right-2 h-4 w-4 text-red-500"
                                onClick={() => removeColorVariationImage(colorIndex, imgIdx)}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Размеры</Label>
                        {(cv.variants || []).map((v, vIdx) => (
                          <div key={vIdx} className="flex gap-2 mt-1 items-center">
                            <Select
                              value={v.size}
                              onValueChange={(val) => handleVariantChange(colorIndex, vIdx, "size", val)}
                            >
                              <SelectTrigger className="flex-1 h-9">
                                <SelectValue placeholder="Размер" />
                              </SelectTrigger>
                              <SelectContent>
                                {sizes.map((s) => (
                                  <SelectItem key={s.name} value={s.name}>{s.russian}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              value={v.stock_quantity}
                              className="w-20"
                              onChange={(e) =>
                                handleVariantChange(colorIndex, vIdx, "stock_quantity", parseInt(e.target.value) || 0)
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleRemoveVariant(colorIndex, vIdx)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => handleAddVariant(colorIndex)}
                        >
                          <PlusCircle className="h-4 w-4 mr-1" /> Размер
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button
                size="lg"
                onClick={handleSave}
                disabled={isLoading}
                className="bg-button-custom hover:bg-button-custom/90 text-card-custom border-0"
              >
                {isLoading ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
