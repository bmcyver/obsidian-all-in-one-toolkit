import { Notice } from 'obsidian';
import type HeicDecode from 'heic-decode';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
};

export const SUPPORTED_IMAGE_TYPES = Object.values(MIME_BY_EXTENSION);

export const SUPPORTED_IMAGE_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

export const CONVERTED_NAME_REGEX = /.+-\d+\.(webp|avif)$/i;

declare const __INCLUDE_HEIC__: boolean;

let heicDecode: typeof HeicDecode | null = null;

export function getExtension(file: File | string): string {
  const name = typeof file === 'string' ? file : file.name;
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function isHeicFile(file: File | string): boolean {
  const ext = getExtension(file);
  return ext === 'heic' || ext === 'heif';
}

export function isAvifFile(file: File | string): boolean {
  return getExtension(file) === 'avif';
}

export function isValidImageFile(file: File): boolean {
  if (isHeicFile(file)) {
    if (!__INCLUDE_HEIC__) {
      new Notice('HEIC conversion is not supported in this build.');
      return false;
    }
    return true;
  }
  if (!file.type.startsWith('image/')) return false;
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    new Notice('Only JPEG, PNG, WebP, AVIF, and HEIC are supported.');
    return false;
  }
  return true;
}

export function getImageMimeType(extension: string): string {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? `image/${extension}`;
}

export async function toWebP(
  file: File,
  quality: number,
): Promise<ArrayBuffer> {
  let decoded: Awaited<ReturnType<typeof HeicDecode>> | null = null;

  if (isHeicFile(file)) {
    if (!__INCLUDE_HEIC__) {
      throw new Error('HEIC conversion is not supported in this build.');
    }
    const heicData = new Uint8Array(await file.arrayBuffer());
    if (!heicDecode) {
      heicDecode = (await import('heic-decode')).default;
    }
    decoded = await heicDecode({ buffer: heicData });
  }

  const source = decoded
    ? new ImageData(
        new Uint8ClampedArray(decoded.data),
        decoded.width,
        decoded.height,
      )
    : file;
  const bitmap = await createImageBitmap(source);

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Failed to create canvas context.');
    ctx.drawImage(bitmap, 0, 0);

    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: Math.max(0, Math.min(1, quality / 100)),
    });

    if (!blob) {
      throw new Error('Failed to convert canvas to WebP blob.');
    }

    return await blob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}
