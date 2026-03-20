import { Label } from "@/components/ui/label";
import { FileInput } from "@/components/ui/file-input";
import { XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface DeliveryStepProps {
  deliveryTimeMin: number | undefined;
  deliveryTimeMax: number | undefined;
  sizingTableImage: string | null;
  sizingTableFile: File | null;
  onDeliveryTimeMinChange: (v: number | undefined) => void;
  onDeliveryTimeMaxChange: (v: number | undefined) => void;
  onSizingTableChange: (file: File | null, url: string | null) => void;
}

export function DeliveryStep({
  deliveryTimeMin, deliveryTimeMax, sizingTableImage, sizingTableFile,
  onDeliveryTimeMinChange, onDeliveryTimeMaxChange, onSizingTableChange,
}: DeliveryStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 bg-accent/10 rounded-lg p-4">
        <Label>Срок доставки (переопределить по умолчанию бренда — необязательно)</Label>
        <p className="text-xs text-muted-foreground">Если не выбрать — применяется срок из настроек бренда.</p>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">От (дней)</Label>
            <Select
              value={deliveryTimeMin !== undefined ? String(deliveryTimeMin) : "none"}
              onValueChange={(v) => onDeliveryTimeMinChange(v === "none" ? undefined : Number(v))}
            >
              <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="По умолчанию" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">По умолчанию</SelectItem>
                {DELIVERY_TIME_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">До (дней)</Label>
            <Select
              value={deliveryTimeMax !== undefined ? String(deliveryTimeMax) : "none"}
              onValueChange={(v) => onDeliveryTimeMaxChange(v === "none" ? undefined : Number(v))}
            >
              <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="По умолчанию" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">По умолчанию</SelectItem>
                {DELIVERY_TIME_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Таблица размеров</Label>
        <p className="text-xs text-muted-foreground">Изображение с таблицей размеров для покупателей</p>
        <FileInput
          accept="image/*"
          onFilesChange={(files) => {
            if (files[0]) {
              onSizingTableChange(files[0], URL.createObjectURL(files[0]));
            }
          }}
          selectedFileNames={sizingTableFile ? [sizingTableFile.name] : []}
          className="mt-1"
        />
        {sizingTableImage && (
          <div className="relative mt-2 inline-block">
            <img src={sizingTableImage} alt="Таблица размеров" className="h-24 object-contain rounded-md border border-border/30" />
            <button
              type="button"
              className="absolute -top-2 -right-2 h-4 w-4 text-red-500"
              onClick={() => onSizingTableChange(null, null)}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
