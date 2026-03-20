import { Badge } from "@/components/ui/badge";
import { translateColorToRussian, translateMaterialToRussian } from "@/lib/translations";
import type { ColorVariationForm } from "@/pages/AddNewItemPage";
import type { CategoryResponse, StyleResponse } from "@/services/api";

interface PreviewStepProps {
  name: string;
  price: string;
  description: string;
  selectedMaterials: string[];
  countryOfManufacture: string;
  selectedCategory: string;
  selectedStyle: string;
  categories: CategoryResponse[];
  styles: StyleResponse[];
  colorVariations: ColorVariationForm[];
  generalImages: string[];
  deliveryTimeMin: number | undefined;
  deliveryTimeMax: number | undefined;
  sizingTableImage: string | null;
}

export function PreviewStep({
  name, price, description, selectedMaterials, countryOfManufacture,
  selectedCategory, selectedStyle, categories, styles,
  colorVariations, generalImages, deliveryTimeMin, deliveryTimeMax, sizingTableImage,
}: PreviewStepProps) {
  const categoryName = categories.find((c) => c.id === selectedCategory)?.name ?? "—";
  const styleName = styles.find((s) => s.id === selectedStyle)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Предпросмотр товара</h3>
        <p className="text-sm text-muted-foreground">Проверьте данные перед отправкой</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Field label="Название" value={name} />
        <Field label="Цена" value={`${price} ₽`} />
        <Field label="Категория" value={categoryName} />
        <Field label="Стиль" value={styleName} />
        <Field label="Страна производства" value={countryOfManufacture || "—"} />
        <Field label="Материалы" value={selectedMaterials.map(translateMaterialToRussian).join(", ") || "—"} />
        {deliveryTimeMin !== undefined && <Field label="Доставка от" value={`${deliveryTimeMin} дн.`} />}
        {deliveryTimeMax !== undefined && <Field label="Доставка до" value={`${deliveryTimeMax} дн.`} />}
      </div>

      {description && (
        <div className="p-3 rounded-lg bg-surface-elevated/50">
          <p className="text-xs text-muted-foreground mb-1">Описание</p>
          <p className="text-sm">{description}</p>
        </div>
      )}

      {/* General images */}
      {generalImages.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Общие изображения</p>
          <div className="flex flex-wrap gap-2">
            {generalImages.map((url, i) => (
              <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-md border border-border/30" />
            ))}
          </div>
        </div>
      )}

      {sizingTableImage && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Таблица размеров</p>
          <img src={sizingTableImage} alt="Sizing" className="h-20 object-contain rounded-md border border-border/30" />
        </div>
      )}

      {/* Color variants */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Варианты по цветам ({colorVariations.length})</p>
        {colorVariations.map((cv, i) => (
          <div key={i} className="p-4 rounded-lg bg-surface-elevated/30 border border-border/30 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full border" style={{ background: cv.colorHex }} />
              <span className="font-medium text-sm">{translateColorToRussian(cv.colorName) || `Цвет ${i + 1}`}</span>
              {cv.images.length > 0 && (
                <Badge variant="outline" className="text-[10px]">{cv.images.length} фото</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {cv.variants.filter((v) => v.size.trim()).map((v, j) => (
                <Badge key={j} variant="outline" className="text-xs">
                  {v.size}: {v.stock_quantity} шт.
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-surface-elevated/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
