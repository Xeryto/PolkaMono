import { Label } from "@/components/ui/label";
import { FileInput } from "@/components/ui/file-input";
import { XCircle } from "lucide-react";
import type { ColorVariationForm } from "@/pages/AddNewItemPage";

interface ImagesStepProps {
  generalImages: string[];
  generalImageFiles: File[];
  colorVariations: ColorVariationForm[];
  onGeneralImages: (files: File[]) => void;
  onRemoveGeneralImage: (index: number) => void;
  onColorVariationImages: (colorIndex: number, files: File[]) => void;
  onRemoveColorVariationImage: (colorIndex: number, imageIndex: number) => void;
}

export function ImagesStep({
  generalImages, generalImageFiles, colorVariations,
  onGeneralImages, onRemoveGeneralImage, onColorVariationImages, onRemoveColorVariationImage,
}: ImagesStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Общие изображения (до 5)</Label>
        <p className="text-xs text-muted-foreground">Для всех цветов</p>
        <FileInput
          multiple
          accept="image/*"
          onFilesChange={onGeneralImages}
          selectedFileNames={generalImageFiles.map((f) => f.name)}
          className="mt-1"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {generalImages.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg hover:ring-2 ring-brand/50 transition-all" />
              <button type="button" className="absolute -top-2 -right-2 h-4 w-4 text-red-500" onClick={() => onRemoveGeneralImage(i)}>
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{generalImages.length}/5 изображений</p>
      </div>

      {colorVariations.map((cv, colorIndex) => (
        <div key={colorIndex} className="space-y-2 p-4 rounded-lg border border-border/30">
          <Label>Изображения для цвета: {cv.colorName || `Цвет ${colorIndex + 1}`} (до 5)</Label>
          <FileInput
            multiple
            accept="image/*"
            onFilesChange={(files) => onColorVariationImages(colorIndex, files)}
            selectedFileNames={cv.imageFiles.map((f) => f.name)}
            className="mt-1"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {cv.images.map((url, imgIdx) => (
              <div key={imgIdx} className="relative">
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg hover:ring-2 ring-brand/50 transition-all" />
                <button type="button" className="absolute -top-2 -right-2 h-4 w-4 text-red-500" onClick={() => onRemoveColorVariationImage(colorIndex, imgIdx)}>
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
