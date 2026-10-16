/**
 * Client-Side Image Compression Utility
 * Compresses receipt and cheque photos to high-efficiency WebP format (~60-120 KB)
 * before transmission over IPC, ensuring zero bloat on local disk and backups.
 */

export interface CompressionResult {
  base64Data: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

export async function compressImageToWebP(
  file: File,
  maxDimension: number = 1280,
  quality: number = 0.82,
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale while preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to obtain canvas 2D rendering context'));
        }

        // High quality bicubic-like downsampling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP format
        let webpData = canvas.toDataURL('image/webp', quality);
        if (!webpData.startsWith('data:image/webp')) {
          // Fallback to jpeg if webp unsupported
          webpData = canvas.toDataURL('image/jpeg', quality);
        }

        // Calculate approximate byte size from base64
        const base64Content = webpData.split(',')[1] || '';
        const compressedSize = Math.round((base64Content.length * 3) / 4);
        const originalSize = file.size;
        const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

        resolve({
          base64Data: webpData,
          originalSize,
          compressedSize,
          compressionRatio,
          width,
          height,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
