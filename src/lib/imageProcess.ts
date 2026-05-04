'use client';

/**
 * 브라우저에서 이미지 압축·EXIF 추출.
 * - 외부 라이브러리 없이 Canvas + DataView로 구현
 * - 1600px 한 변 기준 리사이즈 (긴 변)
 * - JPEG 품질 0.85
 */

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  ext: string;
  mimeType: string;
  taken_at: string | null;
  geo: { lat: number; lon: number } | null;
}

const MAX_DIM = 1600;
const QUALITY = 0.85;

export async function processImage(file: File): Promise<ProcessedImage> {
  // 1) EXIF 추출 (압축 전 원본에서)
  const exif = await readExif(file).catch(() => ({} as any));

  // 2) 이미지 로드 → Canvas 리사이즈
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { canvas, width, height } = resizeToCanvas(img, MAX_DIM);
    const blob = await canvasToBlob(canvas, 'image/jpeg', QUALITY);
    return {
      blob,
      width,
      height,
      ext: 'jpg',
      mimeType: 'image/jpeg',
      taken_at: exif.taken_at ?? null,
      geo: exif.geo ?? null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

function resizeToCanvas(img: HTMLImageElement, max: number) {
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  let w = w0, h = h0;
  if (Math.max(w, h) > max) {
    if (w >= h) {
      w = max;
      h = Math.round(h0 * (max / w0));
    } else {
      h = max;
      w = Math.round(w0 * (max / h0));
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('blob 생성 실패')),
      type,
      quality,
    );
  });
}

// ── EXIF (단순 — JPEG only, 가장 흔한 태그만)
interface ExifResult {
  taken_at: string | null;
  geo: { lat: number; lon: number } | null;
}

async function readExif(file: File): Promise<ExifResult> {
  if (!file.type.includes('jpeg')) {
    return { taken_at: null, geo: null };
  }
  // 앞 256KB만 읽으면 EXIF는 거의 다 들어있음
  const blob = file.slice(0, 256 * 1024);
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);

  // SOI marker 0xFFD8
  if (view.getUint16(0) !== 0xFFD8) return { taken_at: null, geo: null };

  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    // APP1 (EXIF)
    if (marker === 0xE1) {
      const exifStart = offset + 4;
      // "Exif\0\0" 매직
      if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000) {
        return parseExif(view, exifStart + 6);
      }
    }
    offset += 2 + size;
  }
  return { taken_at: null, geo: null };
}

function parseExif(view: DataView, tiffStart: number): ExifResult {
  const little = view.getUint16(tiffStart) === 0x4949;
  const get16 = (o: number) => view.getUint16(o, little);
  const get32 = (o: number) => view.getUint32(o, little);

  if (get16(tiffStart + 2) !== 0x002A) return { taken_at: null, geo: null };

  // IFD0
  const ifd0 = tiffStart + get32(tiffStart + 4);
  const tags = readIFD(view, ifd0, tiffStart, little);

  let taken_at: string | null = null;
  let geo: { lat: number; lon: number } | null = null;

  // ExifIFD pointer (0x8769)
  if (tags[0x8769]) {
    const exifIFD = tiffStart + (tags[0x8769].value as number);
    const exifTags = readIFD(view, exifIFD, tiffStart, little);
    // DateTimeOriginal (0x9003)
    if (exifTags[0x9003]?.value) {
      const s = exifTags[0x9003].value as string;
      // 'YYYY:MM:DD HH:MM:SS' → ISO
      const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (m) {
        taken_at = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
      }
    }
  }

  // GPS IFD pointer (0x8825)
  if (tags[0x8825]) {
    const gpsIFD = tiffStart + (tags[0x8825].value as number);
    const gpsTags = readIFD(view, gpsIFD, tiffStart, little);
    const latRef = (gpsTags[0x0001]?.value as string) ?? 'N';
    const latArr = gpsTags[0x0002]?.value as number[];
    const lonRef = (gpsTags[0x0003]?.value as string) ?? 'E';
    const lonArr = gpsTags[0x0004]?.value as number[];
    if (latArr && lonArr && latArr.length === 3 && lonArr.length === 3) {
      let lat = latArr[0] + latArr[1] / 60 + latArr[2] / 3600;
      let lon = lonArr[0] + lonArr[1] / 60 + lonArr[2] / 3600;
      if (latRef === 'S') lat = -lat;
      if (lonRef === 'W') lon = -lon;
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        geo = { lat, lon };
      }
    }
  }

  return { taken_at, geo };
}

function readIFD(view: DataView, ifdStart: number, tiffStart: number, little: boolean) {
  const get16 = (o: number) => view.getUint16(o, little);
  const get32 = (o: number) => view.getUint32(o, little);
  const result: Record<number, { type: number; count: number; value: any }> = {};
  const count = get16(ifdStart);
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    const tag = get16(entry);
    const type = get16(entry + 2);
    const valCount = get32(entry + 4);
    let value: any;
    // type별 처리
    if (type === 2) {
      // ASCII
      const offsetOrInline = valCount <= 4 ? entry + 8 : tiffStart + get32(entry + 8);
      let s = '';
      for (let k = 0; k < valCount - 1; k++) {
        s += String.fromCharCode(view.getUint8(offsetOrInline + k));
      }
      value = s;
    } else if (type === 3) {
      // SHORT
      value = get16(entry + 8);
    } else if (type === 4) {
      // LONG
      value = get32(entry + 8);
    } else if (type === 5) {
      // RATIONAL — count 개의 (num/den)
      const off = tiffStart + get32(entry + 8);
      const arr: number[] = [];
      for (let k = 0; k < valCount; k++) {
        const num = get32(off + k * 8);
        const den = get32(off + k * 8 + 4);
        arr.push(den ? num / den : 0);
      }
      value = arr;
    } else {
      value = null;
    }
    result[tag] = { type, count: valCount, value };
  }
  return result;
}
