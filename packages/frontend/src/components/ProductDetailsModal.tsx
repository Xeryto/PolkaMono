import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, PlusCircle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
import { sizes, getAllowedSizeTypes, waistValues, lengthValues, type SizeType } from "@/lib/sizes";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { formatCurrency } from "@/lib/currency";
import { ImageCropModal } from "@/components/ImageCropModal";

const DELIVERY_TIME_OPTIONS = [
  { label: "1 день", value: 1 },
  { label: "2 дня", value: 2 },
  { label: "3 дня", value: 3 },
  { label: "5 дней", value: 5 },
  { label: "1 неделя", value: 7 },
  { label: "2 недели", value: 14 },
  { label: "3 недели", value: 21 },
  { label: "1 месяц", value: 30 },
  { label: "2 месяца", value: 60 },
  { label: "3 месяца", value: 90 },
];

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
  const [priceText, setPriceText] = useState(
    product.price ? String(product.price).replace(".", ",") : "",
  );
  const price = parseFloat(priceText.replace(",", ".")) || 0;
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(
    product.material ? product.material.split(", ").filter((m) => m) : [],
  );
  const [colorVariations, setColorVariations] = useState<
    api.ProductColorVariantSchema[]
  >(
    product.color_variants?.length
      ? product.color_variants
      : [{ color_name: "", color_hex: "#808080", images: [], variants: [] }],
  );
  const [colorVariationFiles, setColorVariationFiles] = useState<File[][]>(
    product.color_variants?.map(() => []) || [[]],
  );
  const [generalImages, setGeneralImages] = useState<string[]>(
    product.general_images || [],
  );
  const [generalImageFiles, setGeneralImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    product.styles || [],
  );
  const [styles, setStyles] = useState<api.StyleResponse[]>([]);
  const [categories, setCategories] = useState<api.CategoryResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(
    product.category_id || "",
  );
  // Detect initial size mode from existing variants
  const [sizeMode, setSizeMode] = useState<SizeType>(() => {
    const hasWxL = product.color_variants?.some((cv) =>
      cv.variants?.some((v) => v.size.includes("×")),
    );
    return hasWxL ? "waist_length" : getAllowedSizeTypes(product.category_id || "")[0];
  });
  const [saleType, setSaleType] = useState<"percent" | "exact" | "none">(
    (product.sale_type as "percent" | "exact") || "none",
  );
  const [salePrice, setSalePrice] = useState<string>(
    product.sale_price != null ? String(product.sale_price) : "",
  );
  const [sizingTableImage, setSizingTableImage] = useState<string | null>(
    product.sizing_table_image ?? null,
  );
  const [sizingTableFile, setSizingTableFile] = useState<File | null>(null);
  const [deliveryOverride, setDeliveryOverride] = useState(!product.delivery_inherited);
  const [deliveryTimeMin, setDeliveryTimeMin] = useState<string>(
    product.delivery_time_min != null ? String(product.delivery_time_min) : "",
  );
  const [deliveryTimeMax, setDeliveryTimeMax] = useState<string>(
    product.delivery_time_max != null ? String(product.delivery_time_max) : "",
  );
  const [countryOfManufacture, setCountryOfManufacture] = useState(
    product.country_of_manufacture || "",
  );
  const [activeTab, setActiveTab] = useState<string>("info");

  // Crop modal state
  const [cropItem, setCropItem] = useState<{
    file: File;
    objectUrl: string;
    target: "general" | { color: number };
  } | null>(null);
  const pendingCropQueue = useRef<
    { file: File; target: "general" | { color: number } }[]
  >([]);

  const startCropQueue = useCallback(
    (files: File[], target: "general" | { color: number }) => {
      if (files.length === 0) return;
      const [first, ...rest] = files;
      pendingCropQueue.current = rest.map((f) => ({ file: f, target }));
      setCropItem({
        file: first,
        objectUrl: URL.createObjectURL(first),
        target,
      });
    },
    [],
  );

  const advanceCropQueue = useCallback(() => {
    if (cropItem?.objectUrl) URL.revokeObjectURL(cropItem.objectUrl);
    const next = pendingCropQueue.current.shift();
    if (next) {
      setCropItem({
        file: next.file,
        objectUrl: URL.createObjectURL(next.file),
        target: next.target,
      });
    } else {
      setCropItem(null);
    }
  }, [cropItem]);

  const handleCropConfirm = useCallback(
    (croppedFile: File) => {
      if (!cropItem) return;
      const url = URL.createObjectURL(croppedFile);
      if (cropItem.target === "general") {
        setGeneralImages((prev) => [...prev, url]);
        setGeneralImageFiles((prev) => [...prev, croppedFile]);
      } else {
        const idx = cropItem.target.color;
        updateColorVariation(idx, {
          images: [...(colorVariations[idx]?.images || []), url],
        });
        setColorVariationFiles((prev) => {
          const next = [...prev];
          next[idx] = [...(next[idx] || []), croppedFile];
          return next;
        });
      }
      advanceCropQueue();
    },
    [cropItem, advanceCropQueue, colorVariations],
  );

  const handleCropCancel = useCallback(() => {
    if (cropItem?.objectUrl) URL.revokeObjectURL(cropItem.objectUrl);
    pendingCropQueue.current = [];
    setCropItem(null);
  }, [cropItem]);

  const hasDuplicateSizes = (
    variants: { size: string; stock_quantity: number }[],
  ) => {
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
    setPriceText(product.price ? String(product.price).replace(".", ",") : "");
    setSelectedMaterials(
      product.material ? product.material.split(", ").filter((m) => m) : [],
    );
    setSelectedStyles(product.styles || []);
    setSelectedCategory(product.category_id || "");
    const hasWxL = product.color_variants?.some((cv) =>
      cv.variants?.some((v) => v.size.includes("×")),
    );
    setSizeMode(hasWxL ? "waist_length" : getAllowedSizeTypes(product.category_id || "")[0]);
    setColorVariations(
      product.color_variants?.length
        ? product.color_variants
        : [{ color_name: "", color_hex: "#808080", images: [], variants: [] }],
    );
    setColorVariationFiles(product.color_variants?.map(() => []) || [[]]);
    setGeneralImages(product.general_images || []);
    setGeneralImageFiles([]);
    setSaleType((product.sale_type as "percent" | "exact") || "none");
    setSalePrice(product.sale_price != null ? String(product.sale_price) : "");
    setSizingTableImage(product.sizing_table_image ?? null);
    setSizingTableFile(null);
    setDeliveryOverride(!product.delivery_inherited);
    setDeliveryTimeMin(
      product.delivery_time_min != null
        ? String(product.delivery_time_min)
        : "",
    );
    setDeliveryTimeMax(
      product.delivery_time_max != null
        ? String(product.delivery_time_max)
        : "",
    );
    setCountryOfManufacture(product.country_of_manufacture || "");
    setActiveTab("info");
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
        toast.error("Не удалось загрузить стили и категории.");
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!token) {
      toast.error("Войдите в систему для сохранения.");
      return;
    }
    if (!name.trim()) {
      toast.error("Заполните название товара.");
      return;
    }
    if (!isFinite(price) || price <= 0) {
      toast.error("Цена должна быть больше нуля.");
      return;
    }
    if (!description.trim()) {
      toast.error("Заполните описание.");
      return;
    }
    if (!selectedCategory) {
      toast.error("Выберите категорию.");
      return;
    }
    for (const cv of colorVariations) {
      if (!(cv.color_name || "").trim()) {
        toast.error("У каждого варианта должен быть выбран цвет.");
        return;
      }
      if (hasDuplicateSizes(cv.variants || [])) {
        toast.error(`Дублирующиеся размеры в цвете "${cv.color_name}".`);
        return;
      }
      const filledSizes = (cv.variants || []).filter((v) => v.size.trim());
      if (filledSizes.length === 0) {
        toast.error(`Добавьте хотя бы один размер для цвета "${cv.color_name}".`);
        return;
      }
      for (const v of cv.variants || []) {
        const q = v.stock_quantity;
        if (
          v.size?.trim() &&
          (typeof q !== "number" || q < 0 || !Number.isInteger(q))
        ) {
          toast.error(`Количество не может быть отрицательным (цвет "${cv.color_name}").`);
          return;
        }
      }
    }

    if (selectedMaterials.length === 0) {
      toast.error("Выберите хотя бы один материал.");
      return;
    }
    if (!countryOfManufacture.trim()) {
      toast.error("Укажите страну производства.");
      return;
    }
    if (saleType !== "none" && salePrice !== "") {
      const salePriceNum = parseFloat(salePrice.replace(",", "."));
      if (!isFinite(salePriceNum)) {
        toast.error("Введите корректное значение скидки.");
        return;
      }
      if (saleType === "percent") {
        if (salePriceNum < 1 || salePriceNum > 99) {
          toast.error("Процент скидки должен быть от 1 до 99.");
          return;
        }
      } else if (saleType === "exact") {
        if (salePriceNum < 0) {
          toast.error("Цена со скидкой не может быть отрицательной.");
          return;
        }
        if (salePriceNum >= price) {
          toast.error("Цена со скидкой должна быть меньше обычной цены.");
          return;
        }
      }
    }

    const existingGeneralUrls = (generalImages || []).filter((u) =>
      u.startsWith("http"),
    );
    const newGeneralCount = generalImageFiles?.length ?? 0;
    const totalGeneral = existingGeneralUrls.length + newGeneralCount;
    const totalPerColor = colorVariations.map(
      (cv, i) =>
        (cv.images || []).filter((u: string) => u.startsWith("http")).length +
        (colorVariationFiles?.[i]?.length ?? 0),
    );
    const hasGeneral = totalGeneral > 0;
    const hasAtLeastOnePerColor =
      totalPerColor.length > 0 && totalPerColor.every((n) => n > 0);
    if (!hasGeneral && !hasAtLeastOnePerColor) {
      toast.error("Нужно хотя бы одно общее изображение или хотя бы одно изображение в каждом цвете.");
      return;
    }

    setIsLoading(true);
    try {
      const uploadOne = async (file: File): Promise<string> => {
        const contentType = file.type || "image/jpeg";
        const { upload_url, public_url } =
          await api.getProductImagePresignedUrl(contentType, token!, file.name);
        await api.uploadFileToPresignedUrl(file, upload_url, contentType);
        return public_url;
      };

      const existingGeneralUrls = (generalImages || []).filter((u) =>
        u.startsWith("http"),
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
            u.startsWith("http"),
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
              (v) => v.size.trim() && v.stock_quantity >= 0,
            ),
          };
        }),
      );

      let finalSizingTableImage = sizingTableImage?.startsWith("http")
        ? sizingTableImage
        : null;
      if (sizingTableFile) {
        finalSizingTableImage = await uploadOne(sizingTableFile);
      }

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
          sale_price:
            saleType !== "none" && salePrice !== ""
              ? parseFloat(salePrice.replace(",", "."))
              : null,
          sale_type: saleType !== "none" ? saleType : null,
          sizing_table_image: finalSizingTableImage,
          delivery_time_min:
            deliveryOverride && deliveryTimeMin !== ""
              ? parseInt(deliveryTimeMin)
              : null,
          delivery_time_max:
            deliveryOverride && deliveryTimeMax !== ""
              ? parseInt(deliveryTimeMax)
              : null,
          country_of_manufacture: countryOfManufacture || null,
        },
        token!,
      );
      toast.success("товар обновлен.");
      onProductUpdated();
      onClose();
    } catch (error) {
      toast.error("Не удалось обновить товар.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateColorVariation = (
    colorIndex: number,
    upd: Partial<api.ProductColorVariantSchema>,
  ) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = { ...next[colorIndex], ...upd };
      return next;
    });
  };

  const handleVariantChange = (
    colorIndex: number,
    variantIndex: number,
    field: string,
    value: string | number,
  ) => {
    setColorVariations((prev) => {
      const next = [...prev];
      const vars = [...(next[colorIndex].variants || [])];
      (vars[variantIndex] as unknown as Record<string, string | number>)[
        field
      ] = value;
      next[colorIndex] = { ...next[colorIndex], variants: vars };
      return next;
    });
  };

  const getAvailableSizes = (
    variants: { size: string; stock_quantity: number }[],
  ) => {
    const selected = variants.map((v) => v.size.trim()).filter(Boolean);
    const hasOneSize = selected.includes("One Size");
    const hasOther = selected.some((s) => s !== "One Size");
    return sizes.filter((s) => {
      if (hasOneSize && s.name !== "One Size") return false;
      if (hasOther && s.name === "One Size") return false;
      return true;
    });
  };

  const allowedSizeTypes = getAllowedSizeTypes(selectedCategory);
  const currentSizeType = allowedSizeTypes.length > 1 ? sizeMode : allowedSizeTypes[0];

  const canAddVariant = (
    variants: { size: string; stock_quantity: number }[],
  ) => {
    return !variants.some((v) => v.size === "One Size");
  };

  const handleAddVariant = (colorIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      const vars = [
        ...(next[colorIndex].variants || []),
        { size: "", stock_quantity: 0 },
      ];
      next[colorIndex] = { ...next[colorIndex], variants: vars };
      return next;
    });
  };

  const handleRemoveVariant = (colorIndex: number, variantIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = {
        ...next[colorIndex],
        variants: (next[colorIndex].variants || []).filter(
          (_, i) => i !== variantIndex,
        ),
      };
      return next;
    });
  };

  const handleColorSelect = (colorIndex: number, colorName: string) => {
    const c = colors.find((x) => x.name === colorName);
    if (c)
      updateColorVariation(colorIndex, {
        color_name: c.name,
        color_hex: c.hex,
      });
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
      toast.error("Должен остаться хотя бы один цвет.");
      return;
    }
    setColorVariations((prev) => prev.filter((_, i) => i !== colorIndex));
    setColorVariationFiles((prev) => prev.filter((_, i) => i !== colorIndex));
  };

  const handleColorVariationImages = (colorIndex: number, files: File[]) => {
    const prev = colorVariations[colorIndex];
    if ((prev.images?.length || 0) + files.length > 5) {
      toast.error("Максимум 5 изображений на цвет.");
      return;
    }
    startCropQueue(files, { color: colorIndex });
  };

  const removeColorVariationImage = (
    colorIndex: number,
    imageIndex: number,
  ) => {
    const prev = colorVariations[colorIndex];
    const newImages = (prev.images || []).filter((_, i) => i !== imageIndex);
    updateColorVariation(colorIndex, { images: newImages });
    setColorVariationFiles((prev) => {
      const next = [...prev];
      next[colorIndex] = (next[colorIndex] || []).filter(
        (_, i) => i !== imageIndex,
      );
      return next;
    });
  };

  const handleGeneralImages = (files: File[]) => {
    if (generalImages.length + files.length > 5) {
      toast.error("Максимум 5 общих изображений.");
      return;
    }
    startCropQueue(files, "general");
  };

  const removeGeneralImage = (index: number) => {
    setGeneralImages((prev) => prev.filter((_, i) => i !== index));
    setGeneralImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border/30">
        {/* Modal header with gradient accent */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-brand/8 via-brand/3 to-transparent pointer-events-none" />
          <div className="relative">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Редактировать товар
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {name || product.name} {price > 0 && <span className="text-brand font-medium">· {formatCurrency(price)}</span>}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 bg-surface-elevated/50">
              <TabsTrigger value="info">Информация</TabsTrigger>
              <TabsTrigger value="sale">Скидка</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Основная информация</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="rounded-xl bg-surface-elevated/50 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Артикул</p>
                      <p className="text-sm font-medium font-mono mt-0.5">{product.article_number || "Не присвоен"}</p>
                    </div>
                    <Lock className="h-4 w-4 text-muted-foreground/40" />
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
                      inputMode="decimal"
                      placeholder="напр., 150,00"
                      className="mt-1"
                      value={priceText}
                      onChange={(e) => setPriceText(e.target.value)}
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
                  <div>
                    <Label htmlFor="country_of_manufacture">
                      Страна производства
                    </Label>
                    <Input
                      id="country_of_manufacture"
                      placeholder="напр., Италия"
                      className="mt-1"
                      value={countryOfManufacture}
                      onChange={(e) => setCountryOfManufacture(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="category">Категория</Label>
                    {categories.length === 0 ? (
                      <Skeleton className="h-10 w-full mt-1" />
                    ) : (
                    <Select
                      onValueChange={(val) => {
                        setSelectedCategory(val);
                        setSizeMode(getAllowedSizeTypes(val)[0]);
                      }}
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
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Изображения</h3>
                  </div>
                  <div className="space-y-2">
                    <Label>Общие изображения (до 5)</Label>
                    <p className="text-xs text-muted-foreground">
                      Для всех цветов
                    </p>
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
                            className="w-24 h-24 object-cover rounded-lg hover:ring-2 ring-brand/50 transition-all"
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
                      selectedFileNames={
                        sizingTableFile ? [sizingTableFile.name] : []
                      }
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
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Варианты по цветам</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Цвета</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddColorVariation}
                      >
                        <PlusCircle className="h-4 w-4 mr-1" /> Добавить цвет
                      </Button>
                    </div>
                    {colorVariations.map((cv, colorIndex) => (
                      <Card
                        key={colorIndex}
                        className="p-4 rounded-xl bg-surface-elevated/30 border-border/40 hover:border-brand/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Select
                              value={cv.color_name || ""}
                              onValueChange={(v) =>
                                handleColorSelect(colorIndex, v)
                              }
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue placeholder="Цвет" />
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleRemoveColorVariation(colorIndex)
                            }
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
                            onFilesChange={(files) =>
                              handleColorVariationImages(colorIndex, files)
                            }
                            selectedFileNames={(
                              colorVariationFiles[colorIndex] || []
                            ).map((f) => f.name)}
                            className="mt-1"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(cv.images || []).map((url, imgIdx) => (
                              <div key={imgIdx} className="relative">
                                <img
                                  src={url}
                                  alt=""
                                  className="w-24 h-24 object-cover rounded-lg hover:ring-2 ring-brand/50 transition-all"
                                />
                                <button
                                  type="button"
                                  className="absolute -top-2 -right-2 h-4 w-4 text-red-500"
                                  onClick={() =>
                                    removeColorVariationImage(
                                      colorIndex,
                                      imgIdx,
                                    )
                                  }
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Размеры и инвентарь</Label>
                          {allowedSizeTypes.length > 1 && (
                            <div className="flex gap-2 mt-1 mb-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={sizeMode === "standard" ? "default" : "outline"}
                                onClick={() => setSizeMode("standard")}
                              >
                                Стандартные (XS–XL)
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={sizeMode === "waist_length" ? "default" : "outline"}
                                onClick={() => setSizeMode("waist_length")}
                              >
                                Ширина × Длина (см)
                              </Button>
                            </div>
                          )}
                          {(cv.variants || []).map((v, vIdx) => (
                            <div
                              key={vIdx}
                              className="flex gap-2 mt-1 items-center"
                            >
                              {currentSizeType === "waist_length" ? (
                                <div className="flex gap-1 flex-1">
                                  <Select
                                    value={v.size.includes("×") ? v.size.split("×")[0] : ""}
                                    onValueChange={(waist) => {
                                      const length = v.size.includes("×") ? v.size.split("×")[1] : "";
                                      const newSize = length ? `${waist}×${length}` : waist;
                                      handleVariantChange(colorIndex, vIdx, "size", newSize);
                                    }}
                                  >
                                    <SelectTrigger className="flex-1 h-9">
                                      <SelectValue placeholder="Ширина, см" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {waistValues.map((w) => (
                                        <SelectItem key={w} value={String(w)}>
                                          {w}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="self-center text-muted-foreground">×</span>
                                  <Select
                                    value={v.size.includes("×") ? v.size.split("×")[1] : ""}
                                    onValueChange={(length) => {
                                      const waist = v.size.includes("×") ? v.size.split("×")[0] : "";
                                      const newSize = waist ? `${waist}×${length}` : length;
                                      handleVariantChange(colorIndex, vIdx, "size", newSize);
                                    }}
                                  >
                                    <SelectTrigger className="flex-1 h-9">
                                      <SelectValue placeholder="Длина, см" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {lengthValues.map((l) => (
                                        <SelectItem key={l} value={String(l)}>
                                          {l}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <Select
                                  value={v.size}
                                  onValueChange={(val) =>
                                    handleVariantChange(
                                      colorIndex,
                                      vIdx,
                                      "size",
                                      val,
                                    )
                                  }
                                >
                                  <SelectTrigger className="flex-1 h-9">
                                    <SelectValue placeholder="Размер" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableSizes(cv.variants || []).map(
                                      (s) => (
                                        <SelectItem key={s.name} value={s.name}>
                                          {s.russian}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                              <Input
                                type="number"
                                min={0}
                                value={v.stock_quantity}
                                className="w-20"
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
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() =>
                                  handleRemoveVariant(colorIndex, vIdx)
                                }
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
                            disabled={!canAddVariant(cv.variants || [])}
                          >
                            <PlusCircle className="h-4 w-4 mr-1" /> Размер
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
              {/* Delivery time override */}
              <div className="flex items-center gap-2 pt-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Доставка</h3>
              </div>
              <div className="bg-accent/10 border border-border/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">
                      Срок доставки для этого товара
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Переопределяет настройки бренда
                    </p>
                  </div>
                  <Select
                    value={deliveryOverride ? "custom" : "default"}
                    onValueChange={(v) => {
                      const on = v === "custom";
                      setDeliveryOverride(on);
                      if (!on) {
                        setDeliveryTimeMin("");
                        setDeliveryTimeMax("");
                      }
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        По умолчанию бренда
                      </SelectItem>
                      <SelectItem value="custom">Указать для товара</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {deliveryOverride && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Минимальный срок</Label>
                      <Select
                        value={deliveryTimeMin || "none"}
                        onValueChange={(v) =>
                          setDeliveryTimeMin(v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {DELIVERY_TIME_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Максимальный срок</Label>
                      <Select
                        value={deliveryTimeMax || "none"}
                        onValueChange={(v) =>
                          setDeliveryTimeMax(v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {DELIVERY_TIME_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sale" className="space-y-4">
              {/* Sale price preview card */}
              {saleType !== "none" && salePrice !== "" && price > 0 && (
                <div className="rounded-xl border border-brand/20 bg-gradient-to-r from-brand/5 to-transparent p-5 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Было</p>
                    <p className="text-xl line-through text-muted-foreground">{formatCurrency(price)}</p>
                  </div>
                  <div className="h-8 w-px bg-border/30" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Стало</p>
                    <p className="text-xl font-bold text-green-500">
                      {saleType === "percent"
                        ? formatCurrency(Math.round(price * (1 - parseFloat(salePrice.replace(",", ".")) / 100)))
                        : formatCurrency(parseFloat(salePrice.replace(",", ".")))}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-semibold">
                      {saleType === "percent"
                        ? `-${salePrice}%`
                        : `-${Math.round((1 - parseFloat(salePrice.replace(",", ".")) / price) * 100)}%`}
                    </span>
                  </div>
                </div>
              )}
              <div className="border border-border/30 rounded-xl bg-surface-elevated/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Настройки скидки</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Тип скидки</Label>
                    <Select
                      value={saleType}
                      onValueChange={(v) =>
                        setSaleType(v as "percent" | "exact" | "none")
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Без скидки" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без скидки</SelectItem>
                        <SelectItem value="percent">Процент (%)</SelectItem>
                        <SelectItem value="exact">
                          Фиксированная цена (₽)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {saleType !== "none" && (
                    <div>
                      <Label>
                        {saleType === "percent"
                          ? "Скидка (%)"
                          : "Цена со скидкой (₽)"}
                      </Label>
                      <Input
                        inputMode="decimal"
                        placeholder={
                          saleType === "percent" ? "напр., 20" : "напр., 1990"
                        }
                        className="mt-1"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                      />
                      {saleType === "percent" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Покупатели увидят цену{" "}
                          {salePrice && price > 0
                            ? formatCurrency(
                                Math.round(
                                  price *
                                    (1 -
                                      parseFloat(salePrice.replace(",", ".")) /
                                        100),
                                ),
                              )
                            : "—"}
                        </p>
                      )}
                      {saleType === "exact" && salePrice !== "" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {parseFloat(salePrice.replace(",", ".")) >= price
                            ? "Цена со скидкой должна быть меньше обычной"
                            : `Покупатели увидят цену ${formatCurrency(parseFloat(salePrice.replace(",", ".")))}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end items-center gap-3 pt-4 mt-2 border-t border-border/30">
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
              Отмена
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 px-8 rounded-xl"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isLoading ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </div>
      </DialogContent>

      <ImageCropModal
        imageSrc={cropItem?.objectUrl ?? null}
        originalFile={cropItem?.file ?? null}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </Dialog>
  );
};
