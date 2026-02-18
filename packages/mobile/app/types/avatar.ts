/**
 * Device-independent avatar transform. Store this (e.g. in profile) and re-apply
 * at render time using container size so positioning is consistent across
 * devices, orientations, and app restarts.
 */
export type NormalizedAvatarTransform = {
  scale: number;
  translateXPercent: number; // -1 to 1
  translateYPercent: number; // -1 to 1
};

const SCALE_MIN = 1;
const SCALE_MAX = 3;
const TRANSLATE_PERCENT_CLAMP = 1;

export function clampNormalizedTransform(
  t: NormalizedAvatarTransform
): NormalizedAvatarTransform {
  return {
    scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, t.scale)),
    translateXPercent: Math.max(
      -TRANSLATE_PERCENT_CLAMP,
      Math.min(TRANSLATE_PERCENT_CLAMP, t.translateXPercent)
    ),
    translateYPercent: Math.max(
      -TRANSLATE_PERCENT_CLAMP,
      Math.min(TRANSLATE_PERCENT_CLAMP, t.translateYPercent)
    ),
  };
}

export function parseAvatarTransform(
  json: string | null | undefined
): NormalizedAvatarTransform | null {
  if (!json) return null;
  try {
    const t = JSON.parse(json) as NormalizedAvatarTransform;
    if (
      typeof t.scale === "number" &&
      typeof t.translateXPercent === "number" &&
      typeof t.translateYPercent === "number"
    ) {
      return clampNormalizedTransform(t);
    }
  } catch {
    // ignore
  }
  return null;
}

/** Convert normalized transform to pixel values for a given container size. */
export function transformToPixels(
  t: NormalizedAvatarTransform,
  containerWidth: number,
  containerHeight: number
): { scale: number; translateX: number; translateY: number } {
  return {
    scale: t.scale,
    translateX: t.translateXPercent * containerWidth,
    translateY: t.translateYPercent * containerHeight,
  };
}

/** Convert pixel values to normalized transform (container size). */
export function pixelsToTransform(
  scale: number,
  translateX: number,
  translateY: number,
  containerWidth: number,
  containerHeight: number
): NormalizedAvatarTransform {
  return clampNormalizedTransform({
    scale,
    translateXPercent: translateX / containerWidth,
    translateYPercent: translateY / containerHeight,
  });
}
