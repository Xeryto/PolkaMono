import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { materials } from "@/lib/materials";
import type { CategoryResponse, StyleResponse } from "@/services/api";

interface BasicInfoStepProps {
  name: string;
  price: string;
  description: string;
  selectedMaterials: string[];
  countryOfManufacture: string;
  selectedCategory: string;
  selectedStyle: string;
  categories: CategoryResponse[];
  styles: StyleResponse[];
  fieldErrors: Record<string, string>;
  onNameChange: (v: string) => void;
  onPriceChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onMaterialsChange: (v: string[]) => void;
  onCountryChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onStyleChange: (v: string) => void;
}

export function BasicInfoStep({
  name, price, description, selectedMaterials, countryOfManufacture,
  selectedCategory, selectedStyle, categories, styles, fieldErrors,
  onNameChange, onPriceChange, onDescriptionChange, onMaterialsChange,
  onCountryChange, onCategoryChange, onStyleChange,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Название товара</Label>
        <Input id="name" placeholder="напр., Элитное худи" className="mt-1" value={name} onChange={(e) => onNameChange(e.target.value)} />
        {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <Label htmlFor="price">Цена</Label>
        <Input id="price" inputMode="decimal" placeholder="напр., 150,00" className="mt-1" value={price} onChange={(e) => onPriceChange(e.target.value)} />
        {fieldErrors.price && <p className="text-xs text-destructive mt-1">{fieldErrors.price}</p>}
      </div>
      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" placeholder="Краткое описание товара" className="mt-1" value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
        {fieldErrors.description && <p className="text-xs text-destructive mt-1">{fieldErrors.description}</p>}
      </div>
      <div>
        <Label>Материал</Label>
        <MultiSelect
          options={materials.map((m) => ({ label: m.russian, value: m.name }))}
          value={selectedMaterials}
          onValueChange={onMaterialsChange}
          placeholder="Выберите материалы"
          className="mt-1"
        />
        {fieldErrors.selectedMaterials && <p className="text-xs text-destructive mt-1">{fieldErrors.selectedMaterials}</p>}
      </div>
      <div>
        <Label htmlFor="country">Страна производства</Label>
        <Input id="country" placeholder="напр., Италия" className="mt-1" value={countryOfManufacture} onChange={(e) => onCountryChange(e.target.value)} />
        {fieldErrors.countryOfManufacture && <p className="text-xs text-destructive mt-1">{fieldErrors.countryOfManufacture}</p>}
      </div>
      <div>
        <Label>Категория</Label>
        <Select onValueChange={onCategoryChange} value={selectedCategory}>
          <SelectTrigger className="w-full mt-1 h-10">
            <SelectValue placeholder="Выберите категорию" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {fieldErrors.selectedCategory && <p className="text-xs text-destructive mt-1">{fieldErrors.selectedCategory}</p>}
      </div>
      <div>
        <Label>Стиль</Label>
        <Select onValueChange={onStyleChange} value={selectedStyle}>
          <SelectTrigger className="w-full mt-1 h-10">
            <SelectValue placeholder="Выберите стиль" />
          </SelectTrigger>
          <SelectContent>
            {styles.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {fieldErrors.selectedStyle && <p className="text-xs text-destructive mt-1">{fieldErrors.selectedStyle}</p>}
      </div>
    </div>
  );
}
