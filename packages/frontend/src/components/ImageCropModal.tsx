import React, { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, RotateCcw, ZoomIn } from "lucide-react";

const ASPECT = 1080 / 1680; // 9:14
const OUTPUT_W = 1080;
const OUTPUT_H = 1680;

async function getCroppedImg(
  imageSrc: string,
  crop: Area,
  originalFile: File | null,
): Promise<File> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_W,
    OUTPUT_H,
  );

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92),
  );
  const name = originalFile?.name?.replace(/\.[^.]+$/, ".jpg") || "cropped.jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

interface ImageCropModalProps {
  imageSrc: string | null;
  originalFile: File | null;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  originalFile,
  onConfirm,
  onCancel,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  }, [imageSrc]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    setIsCropping(true);
    try {
      const file = await getCroppedImg(imageSrc, croppedArea, originalFile);
      onConfirm(file);
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <Dialog open={!!imageSrc} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-border/30">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg font-bold">Обрезать изображение</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Перетащите для позиционирования, колёсико мыши для масштаба
          </p>
        </DialogHeader>

        {/* Cropper area with inset shadow */}
        <div
          className="relative w-full min-h-[250px] bg-black/20"
          style={{ height: "clamp(250px, 50dvh, 400px)" }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Controls */}
        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-elevated/50 p-3">
            <ZoomIn className="h-4 w-4 text-brand shrink-0" />
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <span className="text-sm font-medium text-foreground w-12 text-right tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hover:bg-accent/50"
              onClick={handleReset}
              title="Сбросить"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button onClick={handleConfirm} disabled={isCropping}>
              {isCropping && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Применить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
