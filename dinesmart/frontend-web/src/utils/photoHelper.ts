/**
 * Photo helper utility for formatting image URLs, converting Google Drive links,
 * and handling fallbacks.
 */

export const PRESET_AVATARS = [
  {
    name: 'Waiter (Male)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Waitress (Female)',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Head Chef',
    url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Manager',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Supervisor',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Hospitality Staff',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  }
];

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
  if (!name || typeof name !== 'string') return 'S';
  const clean = name.trim().split(/\s+/).filter(Boolean);
  if (clean.length === 0) return 'S';
  if (clean.length === 1) {
    return clean[0].substring(0, 2).toUpperCase();
  }
  return (clean[0][0] + clean[clean.length - 1][0]).toUpperCase();
}
