const MAX_DIM = 512;
const MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const DIM_STEPS = [MAX_DIM, 384, 256];
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

type DecodedImage = ImageBitmap | HTMLImageElement;

export async function normalizeProfileImage(file: File): Promise<string> {
  const decoded = await decodeImage(file);
  const width = 'naturalWidth' in decoded ? decoded.naturalWidth : decoded.width;
  const height = 'naturalHeight' in decoded ? decoded.naturalHeight : decoded.height;

  if (!width || !height) {
    releaseImage(decoded);
    throw new Error('Could not read image.');
  }

  try {
    const mime = canvasSupportsType('image/webp') ? 'image/webp' : 'image/jpeg';

    for (const maxDim of DIM_STEPS) {
      const dataUrl = renderAtSize(decoded, width, height, maxDim, mime, QUALITY_STEPS);
      if (dataUrl && estimateBase64Size(dataUrl) <= MAX_BYTES) return dataUrl;
    }

    const fallback = renderAtSize(
      decoded, width, height, DIM_STEPS[DIM_STEPS.length - 1], mime, [QUALITY_STEPS[QUALITY_STEPS.length - 1]],
    );
    if (!fallback) throw new Error('Could not process image.');
    return fallback;
  } finally {
    releaseImage(decoded);
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      // fall through to HTMLImageElement path
    }
  }
  return loadHTMLImage(file);
}

function loadHTMLImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
    img.src = url;
  });
}

function releaseImage(img: DecodedImage): void {
  if (typeof (img as ImageBitmap).close === 'function') {
    (img as ImageBitmap).close();
  }
}

function renderAtSize(
  source: DecodedImage,
  srcW: number,
  srcH: number,
  maxDim: number,
  mime: string,
  qualities: number[],
): string | null {
  const { width, height } = computeDims(srcW, srcH, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  let last: string | null = null;
  for (const q of qualities) {
    const dataUrl = canvas.toDataURL(mime, q);
    last = dataUrl;
    if (estimateBase64Size(dataUrl) <= MAX_BYTES) return dataUrl;
  }
  return last;
}

function computeDims(srcW: number, srcH: number, maxDim: number): { width: number; height: number } {
  const longer = Math.max(srcW, srcH);
  const scale = longer > maxDim ? maxDim / longer : 1;
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

function canvasSupportsType(mime: string): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

function estimateBase64Size(dataUrl: string): number {
  const idx = dataUrl.indexOf(',');
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
