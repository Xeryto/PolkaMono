import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, XCircle } from "lucide-react";
import { colors } from "@/lib/colors";
import { sizes, getAllowedSizeTypes, waistValues, lengthValues, type SizeType } from "@/lib/sizes";
import type { ColorVariationForm } from "@/pages/AddNewItemPage";

interface SizesInventoryStepProps {
  colorVariations: ColorVariationForm[];
  selectedCategory: string;
  sizeMode: SizeType;
  onSizeModeChange: (mode: SizeType) => void;
  onColorVariationsChange: (cvs: ColorVariationForm[]) => void;
}

function hasDuplicateSizes(variants: { size: string; stock_quantity: number }[]) {
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v.size.trim()) continue;
    if (seen.has(v.size)) return true;
    seen.add(v.size);
  }
  return false;
}

export function SizesInventoryStep({
  colorVariations, selectedCategory, sizeMode, onSizeModeChange, onColorVariationsChange,
}: SizesInventoryStepProps) {
  const allowedSizeTypes = getAllowedSizeTypes(selectedCategory);
  const currentSizeType = allowedSizeTypes.length > 1 ? sizeMode : allowedSizeTypes[0];

  const update = (index: number, upd: Partial<ColorVariationForm>) => {
    const next = [...colorVariations];
    next[index] = { ...next[index], ...upd };
    onColorVariationsChange(next);
  };

  const handleColorSelect = (index: number, colorName: string) => {
    const c = colors.find((x) => x.name === colorName);
    if (c) update(index, { colorName: c.name, colorHex: c.hex });
  };

  const handleVariantChange = (colorIndex: number, variantIndex: number, field: string, value: string | number) => {
    const next = [...colorVariations];
    const vars = [...next[colorIndex].variants];
    (vars[variantIndex] as unknown as Record<string, string | number>)[field] = value;
    next[colorIndex] = { ...next[colorIndex], variants: vars };
    onColorVariationsChange(next);
  };

  const addVariant = (colorIndex: number) => {
    const next = [...colorVariations];
    next[colorIndex] = { ...next[colorIndex], variants: [...next[colorIndex].variants, { size: "", stock_quantity: 0 }] };
    onColorVariationsChange(next);
  };

  const removeVariant = (colorIndex: number, variantIndex: number) => {
    const next = [...colorVariations];
    next[colorIndex] = { ...next[colorIndex], variants: next[colorIndex].variants.filter((_, i) => i !== variantIndex) };
    onColorVariationsChange(next);
  };

  const addColor = () => {
    onColorVariationsChange([...colorVariations, { colorName: "", colorHex: "#808080", images: [], imageFiles: [], variants: [{ size: "", stock_quantity: 0 }] }]);
  };

  const removeColor = (index: number) => {
    if (colorVariations.length <= 1) return;
    onColorVariationsChange(colorVariations.filter((_, i) => i !== index));
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Варианты по цветам</Label>
        <Button type="button" variant="outline" size="sm" onClick={addColor}>
          <PlusCircle className="h-4 w-4 mr-2" /> Добавить цвет
        </Button>
      </div>

      {colorVariations.map((cv, colorIndex) => (
        <Card key={colorIndex} className="p-4 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Цвет {colorIndex + 1}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeColor(colorIndex)} disabled={colorVariations.length <= 1}>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Цвет</Label>
              <Select value={cv.colorName} onValueChange={(v) => handleColorSelect(colorIndex, v)}>
                <SelectTrigger className="w-full mt-1 h-10"><SelectValue placeholder="Выберите цвет" /></SelectTrigger>
                <SelectContent>
                  {colors.map((c) => (
                    <SelectItem key={c.name} value={c.name} textValue={c.russian}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 min-w-4 min-h-4 shrink-0 rounded-full border" style={{ background: c.hex || "#808080" }} />
                        {c.russian}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Размеры и инвентарь</Label>
              {hasDuplicateSizes(cv.variants) && (
                <p className="text-xs text-destructive mt-1">Дублирующиеся размеры</p>
              )}
              {allowedSizeTypes.length > 1 && (
                <div className="flex gap-2 mt-1 mb-1">
                  <Button type="button" size="sm" variant={sizeMode === "standard" ? "default" : "outline"} onClick={() => onSizeModeChange("standard")}>
                    Стандартные (XS–XL)
                  </Button>
                  <Button type="button" size="sm" variant={sizeMode === "waist_length" ? "default" : "outline"} onClick={() => onSizeModeChange("waist_length")}>
                    Ширина × Длина (см)
                  </Button>
                </div>
              )}
              {cv.variants.map((v, vIdx) => (
                <div key={vIdx} className="flex gap-2 mt-1 items-center">
                  {currentSizeType === "waist_length" ? (
                    <div className="flex gap-1 flex-1">
                      <Select
                        value={v.size.includes("×") ? v.size.split("×")[0] : ""}
                        onValueChange={(waist) => {
                          const length = v.size.includes("×") ? v.size.split("×")[1] : "";
                          handleVariantChange(colorIndex, vIdx, "size", length ? `${waist}×${length}` : waist);
                        }}
                      >
                        <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Ширина, см" /></SelectTrigger>
                        <SelectContent>{waistValues.map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="self-center text-muted-foreground">×</span>
                      <Select
                        value={v.size.includes("×") ? v.size.split("×")[1] : ""}
                        onValueChange={(length) => {
                          const waist = v.size.includes("×") ? v.size.split("×")[0] : "";
                          handleVariantChange(colorIndex, vIdx, "size", waist ? `${waist}×${length}` : length);
                        }}
                      >
                        <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Длина, см" /></SelectTrigger>
                        <SelectContent>{lengthValues.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Select value={v.size} onValueChange={(val) => handleVariantChange(colorIndex, vIdx, "size", val)}>
                      <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Размер" /></SelectTrigger>
                      <SelectContent>
                        {getAvailableSizes(cv.variants).map((s) => <SelectItem key={s.name} value={s.name}>{s.russian}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    type="number"
                    placeholder="Кол."
                    value={v.stock_quantity}
                    min={0}
                    className="w-24"
                    onChange={(e) => handleVariantChange(colorIndex, vIdx, "stock_quantity", parseInt(e.target.value) || 0)}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => removeVariant(colorIndex, vIdx)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => addVariant(colorIndex)} disabled={!canAddVariant(cv.variants)}>
                <PlusCircle className="h-4 w-4 mr-2" /> Добавить размер
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
