import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onClear?: () => void;
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: DateRangePickerProps) {
  const hasValue = dateFrom || dateTo;

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">От</Label>
        <Input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-[150px] h-9 bg-input border-border/50 text-foreground"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">До</Label>
        <Input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-[150px] h-9 bg-input border-border/50 text-foreground"
        />
      </div>
      {hasValue && onClear && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={onClear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
