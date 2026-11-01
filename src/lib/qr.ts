import crypto from 'crypto';
import QRCode from 'qrcode';
import { QRPayloadData, SignedQRToken } from './types';

const DEFAULT_SECRET = process.env.QR_SECRET || 'smart_parking_default_secure_secret_key_2026';

/**
 * Base64url encode a string
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64url decode a string
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Compute HMAC-SHA256 signature for a payload
 */
export function computeSignature(dataString: string, secret: string = DEFAULT_SECRET): string {
  return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
}

/**
 * Generate a cryptographically signed QR token string:
 * format: <base64url_json_payload>.<hex_hmac_signature>
 */
export function generateSignedQRToken(data: QRPayloadData, secret: string = DEFAULT_SECRET): string {
  const json = JSON.stringify(data);
  const encodedData = base64UrlEncode(json);
  const signature = computeSignature(encodedData, secret);
  return `${encodedData}.${signature}`;
}

/**
 * Verify a signed QR token string
 */
export function verifySignedQRToken(
  tokenString: string,
  secret: string = DEFAULT_SECRET
): { valid: boolean; data?: QRPayloadData; error?: string } {
  try {
    if (!tokenString || typeof tokenString !== 'string') {
      return { valid: false, error: 'Token string is empty or invalid.' };
    }

    const parts = tokenString.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid token structure. Expected signed payload.' };
    }

    const [encodedData, providedSignature] = parts;
    const expectedSignature = computeSignature(encodedData, secret);

    // Constant-time comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return { valid: false, error: 'Cryptographic signature mismatch. Token has been tampered with.' };
    }

    const decodedJson = base64UrlDecode(encodedData);
    const data = JSON.parse(decodedJson) as QRPayloadData;

    // Validate essential fields
    if (!data.bookingId || !data.slotCode || !data.driverName || !data.vehicleNumber) {
      return { valid: false, error: 'Token missing mandatory booking metadata.' };
    }

    return { valid: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown decoding error';
    return { valid: false, error: `Failed to decode token: ${message}` };
  }
}

/**
 * Render QR code as Data URL (PNG)
 */
export async function generateQRCodeDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0B2545',
      light: '#FFFFFF',
    },
  });
}

/**
 * Render QR code as SVG string
 */
export async function generateQRCodeSVG(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: {
      dark: '#0B2545',
      light: '#FFFFFF',
    },
  });
}
