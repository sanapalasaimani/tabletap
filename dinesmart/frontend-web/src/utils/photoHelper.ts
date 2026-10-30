/**
 * Photo helper utility for formatting image URLs, converting Google Drive links,
 * handling fallbacks, and compressing uploaded images.
 */

/**
 * Compresses an image file (e.g. from camera or gallery) using an HTML5 Canvas
 * to prevent browser storage quota issues and ensure instant sync across website and app.
 */
export function compressImageFile(file: File, maxDim = 360, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts a Google Drive file ID from various link formats:
 * - https://drive.google.com/file/d/FILE_ID/view...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=view&id=FILE_ID
 * - https://drive.google.com/thumbnail?id=FILE_ID
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  // Match /file/d/{id}
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/i);
  if (fileMatch) return fileMatch[1];

  // Match ?id={id} or &id={id}
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/i);
  if (idMatch) return idMatch[1];

  // Match /d/{id}
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{15,})/i);
  if (dMatch) return dMatch[1];

  return null;
}

/**
 * Normalizes photo URLs so they display properly in web browsers.
 * Specially converts Google Drive links into high-reliability direct CDN links.
 */
export function formatPhotoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // If it's a data URL (e.g. uploaded image base64), return as is
  if (trimmed.startsWith('data:image/')) return trimmed;

  // If it's a Google Drive link, convert to direct googleusercontent CDN
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const driveId = extractGoogleDriveId(trimmed);
    if (driveId) {
      // Direct CDN URL that works without cross-origin or 403 embedding issues
      return `https://lh3.googleusercontent.com/d/${driveId}`;
    }
  }

  return trimmed;
}

/**
 * Fallback URL for Google Drive images if lh3 fails
 */
export function getDriveThumbnailFallback(url: string): string | null {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
  }
  return null;
}

/**
 * Returns initials from a full name (e.g., "John Doe" => "JD", "Alex" => "AL")
 */
export function getInitials(name?: string): string {
  if (!name || typeof name !== 'string') return 'W';
  const clean = name.trim().split(/\s+/).filter(Boolean);
  if (clean.length === 0) return 'W';
  if (clean.length === 1) {
    return clean[0].substring(0, 2).toUpperCase();
  }
  return (clean[0][0] + clean[clean.length - 1][0]).toUpperCase();
}
