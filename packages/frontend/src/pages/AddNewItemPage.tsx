import React, { useState, useEffect, useRef, useCallback } from "react";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import * as api from "@/services/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ImageCropModal } from "@/components/ImageCropModal";
import { StepIndicator } from "@/components/addItem/StepIndicator";
import { BasicInfoStep } from "@/components/addItem/BasicInfoStep";
import { DeliveryStep } from "@/components/addItem/DeliveryStep";
import { ImagesStep } from "@/components/addItem/ImagesStep";
import { SizesInventoryStep } from "@/components/addItem/SizesInventoryStep";
import { PreviewStep } from "@/components/addItem/PreviewStep";
import { getAllowedSizeTypes, type SizeType } from "@/lib/sizes";

const STEP_LABELS = ["Основное", "Доставка", "Фото", "Размеры", "Предпросмотр"];
const DRAFT_KEY = "polka_add_item_draft";

const basicSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(255, "Не более 255 символов"),
  price: z.string().min(1, "Цена обязательна").refine(
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

export function AddNewItemPage() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const { token, user } = useAuth();

  // Form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [styles, setStyles] = useState<api.StyleResponse[]>([]);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [categories, setCategories] = useState<api.CategoryResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sizeMode, setSizeMode] = useState<SizeType>("standard");
  const [colorVariations, setColorVariations] = useState<ColorVariationForm[]>([defaultColorVariation()]);
  const [generalImages, setGeneralImages] = useState<string[]>([]);
  const [generalImageFiles, setGeneralImageFiles] = useState<File[]>([]);
  const [deliveryTimeMin, setDeliveryTimeMin] = useState<number | undefined>(undefined);
  const [deliveryTimeMax, setDeliveryTimeMax] = useState<number | undefined>(undefined);
  const [countryOfManufacture, setCountryOfManufacture] = useState("");
  const [sizingTableImage, setSizingTableImage] = useState<string | null>(null);
  const [sizingTableFile, setSizingTableFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Crop modal state
  const [cropItem, setCropItem] = useState<{
    file: File; objectUrl: string; target: "general" | { color: number };
  } | null>(null);
  const pendingCropQueue = useRef<{ file: File; target: "general" | { color: number } }[]>([]);

  // Fetch categories & styles
  useEffect(() => {
    (async () => {
      try {
        const [fetchedStyles, fetchedCategories] = await Promise.all([api.getStyles(), api.getCategories()]);
        setStyles(fetchedStyles);
        setCategories(fetchedCategories);
      } catch {
        toast.error("Не удалось загрузить стили и категории.");
      }
    })();
  }, []);

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.name) setName(draft.name);
      if (draft.price) setPrice(draft.price);
      if (draft.description) setDescription(draft.description);
      if (draft.selectedMaterials) setSelectedMaterials(draft.selectedMaterials);
      if (draft.selectedStyle) setSelectedStyle(draft.selectedStyle);
      if (draft.selectedCategory) setSelectedCategory(draft.selectedCategory);
      if (draft.countryOfManufacture) setCountryOfManufacture(draft.countryOfManufacture);
      if (draft.deliveryTimeMin !== undefined) setDeliveryTimeMin(draft.deliveryTimeMin);
      if (draft.deliveryTimeMax !== undefined) setDeliveryTimeMax(draft.deliveryTimeMax);
      if (draft.step !== undefined) setStep(draft.step);
      toast.info("Черновик восстановлен");
    } catch { /* ignore */ }
  }, []);

  // Save draft on step change
  useEffect(() => {
    try {
      const draft = {
        name, price, description, selectedMaterials, selectedStyle,
        selectedCategory, countryOfManufacture, deliveryTimeMin, deliveryTimeMax, step,
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* ignore */ }
  }, [step, name, price, description, selectedMaterials, selectedStyle, selectedCategory, countryOfManufacture, deliveryTimeMin, deliveryTimeMax]);

  // Crop helpers
  const startCropQueue = useCallback((files: File[], target: "general" | { color: number }) => {
    if (files.length === 0) return;
    const [first, ...rest] = files;
    pendingCropQueue.current = rest.map((f) => ({ file: f, target }));
    setCropItem({ file: first, objectUrl: URL.createObjectURL(first), target });
  }, []);

  const advanceCropQueue = useCallback(() => {
    if (cropItem?.objectUrl) URL.revokeObjectURL(cropItem.objectUrl);
    const next = pendingCropQueue.current.shift();
    if (next) setCropItem({ file: next.file, objectUrl: URL.createObjectURL(next.file), target: next.target });
    else setCropItem(null);
  }, [cropItem]);

  const handleCropConfirm = useCallback((croppedFile: File) => {
    if (!cropItem) return;
    const url = URL.createObjectURL(croppedFile);
    if (cropItem.target === "general") {
      setGeneralImages((prev) => [...prev, url]);
      setGeneralImageFiles((prev) => [...prev, croppedFile]);
    } else {
      const idx = cropItem.target.color;
      setColorVariations((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], images: [...next[idx].images, url], imageFiles: [...next[idx].imageFiles, croppedFile] };
        return next;
      });
    }
    advanceCropQueue();
  }, [cropItem, advanceCropQueue]);

  const handleCropCancel = useCallback(() => {
    if (cropItem?.objectUrl) URL.revokeObjectURL(cropItem.objectUrl);
    pendingCropQueue.current = [];
    setCropItem(null);
  }, [cropItem]);

  const handleGeneralImages = (files: File[]) => {
    if (generalImages.length + files.length > 5) {
      toast.error("Максимум 5 общих изображений.");
      return;
    }
    startCropQueue(files, "general");
  };

  const handleColorVariationImages = (index: number, files: File[]) => {
    if (colorVariations[index].images.length + files.length > 5) {
      toast.error("Максимум 5 изображений на цвет.");
      return;
    }
    startCropQueue(files, { color: index });
  };

  const removeGeneralImage = (index: number) => {
    setGeneralImages((prev) => prev.filter((_, i) => i !== index));
    setGeneralImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeColorVariationImage = (colorIndex: number, imageIndex: number) => {
    setColorVariations((prev) => {
      const next = [...prev];
      next[colorIndex] = {
        ...next[colorIndex],
        images: next[colorIndex].images.filter((_, i) => i !== imageIndex),
        imageFiles: next[colorIndex].imageFiles.filter((_, i) => i !== imageIndex),
      };
      return next;
    });
  };

  // Validation per step
  const validateStep = (s: number): boolean => {
    if (s === 0) {
      const parsed = basicSchema.safeParse({
        name, price, description, selectedCategory, selectedMaterials, countryOfManufacture, selectedStyle,
      });
      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        setFieldErrors({
          name: flat.name?.[0] ?? "", price: flat.price?.[0] ?? "",
          description: flat.description?.[0] ?? "", selectedCategory: flat.selectedCategory?.[0] ?? "",
          selectedMaterials: flat.selectedMaterials?.[0] ?? "", countryOfManufacture: flat.countryOfManufacture?.[0] ?? "",
          selectedStyle: flat.selectedStyle?.[0] ?? "",
        });
        return false;
      }
      setFieldErrors({});
      return true;
    }
    if (s === 1) return true; // delivery is optional
    if (s === 2) return true; // images validated on submit
    if (s === 3) {
      for (const cv of colorVariations) {
        if (!cv.colorName.trim()) { toast.error("Выберите цвет для каждого варианта."); return false; }
        const filled = cv.variants.filter((v) => v.size.trim());
        if (filled.length === 0) { toast.error(`Добавьте размер для цвета "${cv.colorName}".`); return false; }
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setCompletedSteps((prev) => new Set(prev).add(step));
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  const goToStep = (s: number) => {
    if (s < step || completedSteps.has(s)) setStep(s);
  };

  const handleSubmit = async () => {
    // Final validations
    if (!token) { toast.error("Токен не найден. Войдите в систему."); return; }
    const hasGeneralImages = generalImageFiles.length > 0;
    const hasOnePerColor = colorVariations.every((cv) => cv.imageFiles.length > 0);
    if (!hasGeneralImages && !hasOnePerColor) {
      toast.error("Добавьте общие изображения или по изображению на каждый цвет.");
      return;
    }

    setIsLoading(true);
    try {
      const uploadOne = async (file: File): Promise<string> => {
        const contentType = file.type || "image/jpeg";
        const { upload_url, public_url } = await api.getProductImagePresignedUrl(contentType, token, file.name);
        await api.uploadFileToPresignedUrl(file, upload_url, contentType);
        return public_url;
      };

      const generalImageUrls = generalImageFiles.length > 0 ? await Promise.all(generalImageFiles.map(uploadOne)) : [];
      const colorVariantsWithUrls = await Promise.all(
        colorVariations.map(async (cv) => ({
          color_name: cv.colorName,
          color_hex: cv.colorHex,
          images: cv.imageFiles.length > 0 ? await Promise.all(cv.imageFiles.map(uploadOne)) : [],
          variants: cv.variants.filter((v) => v.size.trim() && v.stock_quantity >= 0),
        })),
      );

      let sizingTableImageUrl: string | null = null;
      if (sizingTableFile) sizingTableImageUrl = await uploadOne(sizingTableFile);

      await api.createProduct({
        name,
        price: parseFloat(price.replace(",", ".")),
        description,
        material: selectedMaterials.length > 0 ? selectedMaterials.join(", ") : undefined,
        brand_id: user?.id ?? "",
        category_id: selectedCategory,
        styles: selectedStyle ? [selectedStyle] : [],
        color_variants: colorVariantsWithUrls,
        general_images: generalImageUrls.length > 0 ? generalImageUrls : undefined,
        delivery_time_min: deliveryTimeMin,
        delivery_time_max: deliveryTimeMax,
        country_of_manufacture: countryOfManufacture || undefined,
        sizing_table_image: sizingTableImageUrl || undefined,
      }, token);

      toast.success("Товар успешно добавлен!");
      sessionStorage.removeItem(DRAFT_KEY);

      // Reset
      setName(""); setPrice(""); setDescription(""); setSelectedMaterials([]); setSelectedStyle("");
      setSelectedCategory(""); setColorVariations([defaultColorVariation()]); setGeneralImages([]);
      setGeneralImageFiles([]); setDeliveryTimeMin(undefined); setDeliveryTimeMax(undefined);
      setCountryOfManufacture(""); setSizingTableImage(null); setSizingTableFile(null);
      setStep(0); setCompletedSteps(new Set());
    } catch (error: unknown) {
      console.error("Failed to add product:", error);
      const err = error as { message?: string; fieldErrors?: Record<string, string> };
      if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      toast.error(err.message || "Не удалось добавить товар.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Добавить новый товар</h2>

      <StepIndicator
        steps={STEP_LABELS}
        currentStep={step}
        onStepClick={goToStep}
        completedSteps={completedSteps}
      />

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>{STEP_LABELS[step]}</CardTitle>
          <CardDescription>Шаг {step + 1} из {STEP_LABELS.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <BasicInfoStep
              name={name} price={price} description={description}
              selectedMaterials={selectedMaterials} countryOfManufacture={countryOfManufacture}
              selectedCategory={selectedCategory} selectedStyle={selectedStyle}
              categories={categories} styles={styles} fieldErrors={fieldErrors}
              onNameChange={setName} onPriceChange={setPrice} onDescriptionChange={setDescription}
              onMaterialsChange={setSelectedMaterials} onCountryChange={setCountryOfManufacture}
              onCategoryChange={(v) => { setSelectedCategory(v); setSizeMode(getAllowedSizeTypes(v)[0]); }}
              onStyleChange={setSelectedStyle}
            />
          )}

          {step === 1 && (
            <DeliveryStep
              deliveryTimeMin={deliveryTimeMin} deliveryTimeMax={deliveryTimeMax}
              sizingTableImage={sizingTableImage} sizingTableFile={sizingTableFile}
              onDeliveryTimeMinChange={setDeliveryTimeMin} onDeliveryTimeMaxChange={setDeliveryTimeMax}
              onSizingTableChange={(file, url) => { setSizingTableFile(file); setSizingTableImage(url); }}
            />
          )}

          {step === 2 && (
            <ImagesStep
              generalImages={generalImages} generalImageFiles={generalImageFiles}
              colorVariations={colorVariations}
              onGeneralImages={handleGeneralImages} onRemoveGeneralImage={removeGeneralImage}
              onColorVariationImages={handleColorVariationImages} onRemoveColorVariationImage={removeColorVariationImage}
            />
          )}

          {step === 3 && (
            <SizesInventoryStep
              colorVariations={colorVariations} selectedCategory={selectedCategory}
              sizeMode={sizeMode} onSizeModeChange={setSizeMode}
              onColorVariationsChange={setColorVariations}
            />
          )}

          {step === 4 && (
            <PreviewStep
              name={name} price={price} description={description}
              selectedMaterials={selectedMaterials} countryOfManufacture={countryOfManufacture}
              selectedCategory={selectedCategory} selectedStyle={selectedStyle}
              categories={categories} styles={styles} colorVariations={colorVariations}
              generalImages={generalImages} deliveryTimeMin={deliveryTimeMin}
              deliveryTimeMax={deliveryTimeMax} sizingTableImage={sizingTableImage}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border/30">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Назад
            </Button>

            {step < STEP_LABELS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Далее <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLoading ? "Добавление..." : "Добавить товар"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ImageCropModal
        imageSrc={cropItem?.objectUrl ?? null}
        originalFile={cropItem?.file ?? null}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </div>
  );
}
