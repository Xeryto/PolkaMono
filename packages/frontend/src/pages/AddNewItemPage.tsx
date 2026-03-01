import React, { useState, useEffect } from "react";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import * as api from "@/services/api";
import { parsePydanticErrors } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { colors } from "@/lib/colors";
import { materials } from "@/lib/materials";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileInput } from "@/components/ui/file-input";
import { sizes } from "@/lib/sizes";
import { useAuth } from "@/context/AuthContext";

const DELIVERY_TIME_OPTIONS = [
  { value: 1, label: "1 день" },
  { value: 3, label: "3 дня" },
  { value: 5, label: "5 дней" },
  { value: 7, label: "1 неделя" },
  { value: 14, label: "2 недели" },
  { value: 21, label: "3 недели" },
  { value: 30, label: "1 месяц" },
  { value: 60, label: "2 месяца" },
  { value: 90, label: "3 месяца" },
];

const productSchema = z.object({
  name: z
    .string()
    .min(1, "Название обязательно")
    .max(255, "Не более 255 символов"),
  price: z
    .string()
    .min(1, "Цена обязательна")
    .refine(
      (v) => !isNaN(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) > 0,
      "Цена должна быть больше нуля",
    ),
  description: z.string().max(1000, "Не более 1000 символов").optional(),
  selectedCategory: z.string().min(1, "Выберите категорию"),
  selectedMaterials: z.array(z.string()).min(1, "Выберите хотя бы один материал"),
  countryOfManufacture: z.string().min(1, "Укажите страну производства"),
  selectedStyle: z.string().min(1, "Выберите стиль"),
});

export interface ColorVariationForm {
  colorName: string;
  colorHex: string;
  images: string[];
  imageFiles: File[];
  variants: { size: string; stock_quantity: number }[];
}

const defaultColorVariation = (): ColorVariationForm => ({
  colorName: "",
  colorHex: "#808080",
  images: [],
  imageFiles: [],
  variants: [{ size: "", stock_quantity: 0 }],
});

function hasDuplicateSizes(
  variants: { size: string; stock_quantity: number }[],
) {
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v.size.trim()) continue;
    if (seen.has(v.size)) return true;
    seen.add(v.size);
  }
  return false;
}

export function AddNewItemPage() {
  const [name, setName] = useState("");
  const { token, user } = useAuth();
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [styles, setStyles] = useState<api.StyleResponse[]>([]);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [categories, setCategories] = useState<api.CategoryResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [colorVariations, setColorVariations] = useState<ColorVariationForm[]>([
    defaultColorVariation(),
  ]);
  const [generalImages, setGeneralImages] = useState<string[]>([]);
  const [generalImageFiles, setGeneralImageFiles] = useState<File[]>([]);
  const [deliveryTimeMin, setDeliveryTimeMin] = useState<number | undefined>(
    undefined,
  );
  const [deliveryTimeMax, setDeliveryTimeMax] = useState<number | undefined>(
    undefined,
  );
  const [countryOfManufacture, setCountryOfManufacture] = useState("");
  const [sizingTableImage, setSizingTableImage] = useState<string | null>(null);
  const [sizingTableFile, setSizingTableFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
        console.error("Failed to fetch data:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить стили и категории.",
          variant: "destructive",
        });
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateColorVariation = (
    index: number,
    upd: Partial<ColorVariationForm>,
  ) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...upd };
      return next;
    });
  };

  const handleColorVariationImages = (index: number, files: File[]) => {
    const newUrls = files.map((f) => URL.createObjectURL(f));
    const prev = colorVariations[index];
    if (prev.images.length + newUrls.length > 5) {
      toast({
        title: "Ошибка",
        description: "Максимум 5 изображений на цвет.",
        variant: "destructive",
      });
      return;
    }
    updateColorVariation(index, {
      images: [...prev.images, ...newUrls],
      imageFiles: [...prev.imageFiles, ...files],
    });
  };

  const removeColorVariationImage = (
    colorIndex: number,
    imageIndex: number,
  ) => {
    const prev = colorVariations[colorIndex];
    const newImages = prev.images.filter((_, i) => i !== imageIndex);
    const newImageFiles = prev.imageFiles.filter((_, i) => i !== imageIndex);
    updateColorVariation(colorIndex, {
      images: newImages,
      imageFiles: newImageFiles,
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

  const handleVariantChange = (
    colorIndex: number,
    variantIndex: number,
    field: string,
    value: string | number,
  ) => {
    setColorVariations((prev) => {
      const next = [...prev];
      const vars = [...next[colorIndex].variants];
      (vars[variantIndex] as unknown as Record<string, string | number>)[
        field
      ] = value;
      next[colorIndex] = { ...next[colorIndex], variants: vars };
      return next;
    });
  };

  const getAvailableSizes = (variants: { size: string; stock_quantity: number }[]) => {
    const selected = variants.map((v) => v.size.trim()).filter(Boolean);
    const hasOneSize = selected.includes("One Size");
    const hasOther = selected.some((s) => s !== "One Size");
    return sizes.filter((s) => {
      if (hasOneSize && s.name !== "One Size") return false;
      if (hasOther && s.name === "One Size") return false;
      return true;
    });
  };

  const canAddVariant = (variants: { size: string; stock_quantity: number }[]) => {
    return !variants.some((v) => v.size === "One Size");
  };

  const addVariant = (colorIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = {
        ...next[colorIndex],
        variants: [
          ...next[colorIndex].variants,
          { size: "", stock_quantity: 0 },
        ],
      };
      return next;
    });
  };

  const removeVariant = (colorIndex: number, variantIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = {
        ...next[colorIndex],
        variants: next[colorIndex].variants.filter(
          (_, i) => i !== variantIndex,
        ),
      };
      return next;
    });
  };

  const addColorVariation = () => {
    setColorVariations((prev) => [...prev, defaultColorVariation()]);
  };

  const removeColorVariation = (index: number) => {
    if (colorVariations.length <= 1) {
      toast({
        title: "Ошибка",
        description: "Должен остаться хотя бы один цвет.",
        variant: "destructive",
      });
      return;
    }
    setColorVariations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleColorSelect = (index: number, colorName: string) => {
    const c = colors.find((x) => x.name === colorName);
    if (c) updateColorVariation(index, { colorName: c.name, colorHex: c.hex });
  };

  const handleSubmit = async () => {
    const parsed = productSchema.safeParse({
      name,
      price,
      description,
      selectedCategory,
      selectedMaterials,
      countryOfManufacture,
      selectedStyle,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0] ?? "",
        price: flat.price?.[0] ?? "",
        description: flat.description?.[0] ?? "",
        selectedCategory: flat.selectedCategory?.[0] ?? "",
        selectedMaterials: flat.selectedMaterials?.[0] ?? "",
        countryOfManufacture: flat.countryOfManufacture?.[0] ?? "",
        selectedStyle: flat.selectedStyle?.[0] ?? "",
      });
      return;
    }
    setFieldErrors({});
    const priceNum = parseFloat(price.replace(",", "."));

    for (let i = 0; i < colorVariations.length; i++) {
      const cv = colorVariations[i];
      if (!cv.colorName.trim()) {
        toast({
          title: "Ошибка",
          description: `Выберите цвет для варианта ${i + 1}.`,
          variant: "destructive",
        });
        return;
      }
      if (hasDuplicateSizes(cv.variants)) {
        toast({
          title: "Ошибка",
          description: `Дублирующиеся размеры в варианте цвета "${cv.colorName}".`,
          variant: "destructive",
        });
        return;
      }
      const filledSizes = cv.variants.filter((v) => v.size.trim());
      if (filledSizes.length === 0) {
        toast({
          title: "Ошибка",
          description: `Добавьте хотя бы один размер для цвета "${cv.colorName}".`,
          variant: "destructive",
        });
        return;
      }
      for (const v of cv.variants) {
        if (
          v.size.trim() &&
          (v.stock_quantity < 0 || !Number.isInteger(v.stock_quantity))
        ) {
          toast({
            title: "Ошибка",
            description: `Количество по размеру не может быть отрицательным (цвет "${cv.colorName}").`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (!sizingTableFile) {
      toast({
        title: "Ошибка",
        description: "Загрузите таблицу размеров.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "Ошибка",
        description: "Токен не найден. Войдите в систему.",
        variant: "destructive",
      });
      return;
    }

    const hasGeneralImages = generalImageFiles.length > 0;
    const hasOnePerColor = colorVariations.every(
      (cv) => cv.imageFiles.length > 0,
    );
    if (!hasGeneralImages && !hasOnePerColor) {
      toast({
        title: "Ошибка",
        description:
          "Добавьте хотя бы одно общее изображение или хотя бы одно изображение в каждом цвете.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Upload images to S3 via presigned URLs
      const uploadOne = async (file: File): Promise<string> => {
        const contentType = file.type || "image/jpeg";
        const { upload_url, public_url } =
          await api.getProductImagePresignedUrl(contentType, token, file.name);
        await api.uploadFileToPresignedUrl(file, upload_url, contentType);
        return public_url;
      };

      const generalImageUrls =
        generalImageFiles.length > 0
          ? await Promise.all(generalImageFiles.map(uploadOne))
          : [];

      const colorVariantsWithUrls = await Promise.all(
        colorVariations.map(async (cv) => {
          const imageUrls =
            cv.imageFiles.length > 0
              ? await Promise.all(cv.imageFiles.map(uploadOne))
              : [];
          return {
            color_name: cv.colorName,
            color_hex: cv.colorHex,
            images: imageUrls,
            variants: cv.variants.filter(
              (v) => v.size.trim() && v.stock_quantity >= 0,
            ),
          };
        }),
      );

      let sizingTableImageUrl: string | null = null;
      if (sizingTableFile) {
        sizingTableImageUrl = await uploadOne(sizingTableFile);
      }

      const productData = {
        name,
        price: priceNum,
        description,
        material:
          selectedMaterials.length > 0
            ? selectedMaterials.join(", ")
            : undefined,
        brand_id: user?.id ?? "",
        category_id: selectedCategory,
        styles: selectedStyle ? [selectedStyle] : [],
        color_variants: colorVariantsWithUrls,
        general_images:
          generalImageUrls.length > 0 ? generalImageUrls : undefined,
        delivery_time_min: deliveryTimeMin,
        delivery_time_max: deliveryTimeMax,
        country_of_manufacture: countryOfManufacture || undefined,
        sizing_table_image: sizingTableImageUrl || undefined,
      };

      await api.createProduct(productData, token);
      toast({
        title: "Успех",
        description: "Товар успешно добавлен!",
      });
      setName("");
      setPrice("");
      setDescription("");
      setSelectedMaterials([]);
      setSelectedStyle("");
      setSelectedCategory("");
      setColorVariations([defaultColorVariation()]);
      setGeneralImages([]);
      setGeneralImageFiles([]);
      setDeliveryTimeMin(undefined);
      setDeliveryTimeMax(undefined);
      setCountryOfManufacture("");
      setSizingTableImage(null);
      setSizingTableFile(null);
    } catch (error: unknown) {
      console.error("Failed to add product:", error);
      const err = error as {
        message?: string;
        fieldErrors?: Record<string, string>;
      };
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось добавить товар.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">
        Добавить новый товар
      </h2>

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>Детали товара</CardTitle>
          <CardDescription>
            Заполните детали и варианты по цветам
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Название товара</Label>
            <Input
              id="name"
              placeholder="напр., Элитное худи"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.name}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="price">Цена</Label>
            <Input
              id="price"
              inputMode="decimal"
              placeholder="напр., 150,00"
              className="mt-1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {fieldErrors.price && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.price}
              </p>
            )}
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
            {fieldErrors.description && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="materials">Материал</Label>
            <MultiSelect
              options={materials.map((m) => ({
                label: m.russian,
                value: m.name,
              }))}
              value={selectedMaterials}
              onValueChange={setSelectedMaterials}
              placeholder="Выберите материалы"
              className="mt-1"
            />
            {fieldErrors.selectedMaterials && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.selectedMaterials}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="country_of_manufacture">Страна производства</Label>
            <Input
              id="country_of_manufacture"
              placeholder="напр., Италия"
              className="mt-1"
              value={countryOfManufacture}
              onChange={(e) => setCountryOfManufacture(e.target.value)}
            />
            {fieldErrors.countryOfManufacture && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.countryOfManufacture}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="category">Категория</Label>
            <Select
              onValueChange={setSelectedCategory}
              value={selectedCategory}
            >
              <SelectTrigger className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.selectedCategory && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.selectedCategory}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="style">Стиль</Label>
            <Select onValueChange={setSelectedStyle} value={selectedStyle}>
              <SelectTrigger className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2">
                <SelectValue placeholder="Выберите стиль" />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    {style.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.selectedStyle && (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.selectedStyle}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Срок доставки (переопределить по умолчанию бренда — необязательно)
            </Label>
            <p className="text-xs text-muted-foreground">
              Если не выбрать — применяется срок из настроек бренда.
            </p>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">
                  От (дней)
                </Label>
                <Select
                  value={
                    deliveryTimeMin !== undefined
                      ? String(deliveryTimeMin)
                      : "none"
                  }
                  onValueChange={(v) =>
                    setDeliveryTimeMin(v === "none" ? undefined : Number(v))
                  }
                >
                  <SelectTrigger className="mt-1 h-10">
                    <SelectValue placeholder="По умолчанию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">По умолчанию</SelectItem>
                    {DELIVERY_TIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">
                  До (дней)
                </Label>
                <Select
                  value={
                    deliveryTimeMax !== undefined
                      ? String(deliveryTimeMax)
                      : "none"
                  }
                  onValueChange={(v) =>
                    setDeliveryTimeMax(v === "none" ? undefined : Number(v))
                  }
                >
                  <SelectTrigger className="mt-1 h-10">
                    <SelectValue placeholder="По умолчанию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">По умолчанию</SelectItem>
                    {DELIVERY_TIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                  <img
                    src={url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-md"
                  />
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

          {/* Sizing table image */}
          <div className="space-y-2">
            <Label>Таблица размеров</Label>
            <p className="text-xs text-muted-foreground">
              Изображение с таблицей размеров для покупателей
            </p>
            <FileInput
              accept="image/*"
              onFilesChange={(files) => {
                if (files[0]) {
                  setSizingTableFile(files[0]);
                  setSizingTableImage(URL.createObjectURL(files[0]));
                }
              }}
              selectedFileNames={sizingTableFile ? [sizingTableFile.name] : []}
              className="mt-1"
            />
            {sizingTableImage && (
              <div className="relative mt-2 inline-block">
                <img
                  src={sizingTableImage}
                  alt="Таблица размеров"
                  className="h-24 object-contain rounded-md border border-border/30"
                />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 h-4 w-4 text-red-500"
                  onClick={() => {
                    setSizingTableImage(null);
                    setSizingTableFile(null);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Color variations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Варианты по цветам</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addColorVariation}
              >
                <PlusCircle className="h-4 w-4 mr-2" /> Добавить цвет
              </Button>
            </div>
            {colorVariations.map((cv, colorIndex) => (
              <Card key={colorIndex} className="p-4 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Цвет {colorIndex + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeColorVariation(colorIndex)}
                    disabled={colorVariations.length <= 1}
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Цвет</Label>
                    <Select
                      value={cv.colorName}
                      onValueChange={(v) => handleColorSelect(colorIndex, v)}
                    >
                      <SelectTrigger className="w-full mt-1 h-10">
                        <SelectValue placeholder="Выберите цвет" />
                      </SelectTrigger>
                      <SelectContent>
                        {colors.map((c) => (
                          <SelectItem
                            key={c.name}
                            value={c.name}
                            textValue={c.russian}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 min-w-4 min-h-4 shrink-0 rounded-full border"
                                style={{
                                  background: c.hex || "#808080",
                                }}
                              />
                              {c.russian}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Изображения (до 5)</Label>
                    <FileInput
                      multiple
                      accept="image/*"
                      onFilesChange={(files) =>
                        handleColorVariationImages(colorIndex, files)
                      }
                      selectedFileNames={cv.imageFiles.map((f) => f.name)}
                      className="mt-1"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cv.images.map((url, imgIdx) => (
                        <div key={imgIdx} className="relative">
                          <img
                            src={url}
                            alt=""
                            className="w-20 h-20 object-cover rounded-md"
                          />
                          <button
                            type="button"
                            className="absolute -top-2 -right-2 h-4 w-4 text-red-500"
                            onClick={() =>
                              removeColorVariationImage(colorIndex, imgIdx)
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Размеры и инвентарь</Label>
                    {cv.variants.map((v, vIdx) => (
                      <div key={vIdx} className="flex gap-2 mt-1 items-center">
                        <Select
                          value={v.size}
                          onValueChange={(val) =>
                            handleVariantChange(colorIndex, vIdx, "size", val)
                          }
                        >
                          <SelectTrigger className="flex-1 h-10">
                            <SelectValue placeholder="Размер" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableSizes(cv.variants).map((s) => (
                              <SelectItem key={s.name} value={s.name}>
                                {s.russian}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Кол."
                          value={v.stock_quantity}
                          min={0}
                          className="w-24"
                          onChange={(e) =>
                            handleVariantChange(
                              colorIndex,
                              vIdx,
                              "stock_quantity",
                              parseInt(e.target.value) || 0,
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeVariant(colorIndex, vIdx)}
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
                      onClick={() => addVariant(colorIndex)}
                      disabled={!canAddVariant(cv.variants)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> Добавить размер
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Добавление..." : "Добавить товар"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
