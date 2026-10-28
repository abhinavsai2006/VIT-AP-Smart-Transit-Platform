import crypto from 'crypto';
import QRCode from 'qrcode';

const SECRET_SALT = process.env.TRANSIT_SECRET_SALT || 'vit-ap-smart-transit-production-salt-2026';

export interface TicketTokenPayload {
  tId: string; // Ticket ID
  bId: string; // Booking ID
  trId: string; // Trip ID
  rId: string; // Route ID
  exp: number; // Unix timestamp
  nonce: string; // Random hex
}

/**
 * Creates a cryptographically signed opaque token for a passenger ticket.
 * Structure: VIT-<base64url(payload)>.<signature>
 */
export function generateTicketToken(payload: TicketTokenPayload): string {
  const jsonStr = JSON.stringify(payload);
  const encodedPayload = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(encodedPayload)
    .digest('base64url');

  return `VIT-${encodedPayload}.${signature}`;
}

/**
 * Validates the cryptographic signature of an opaque ticket token and decodes payload.
 */
export function verifyTicketToken(token: string): { isValid: boolean; payload?: TicketTokenPayload; error?: string } {
  if (!token || !token.startsWith('VIT-')) {
    return { isValid: false, error: 'Invalid ticket token prefix.' };
  }

  const parts = token.slice(4).split('.');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Malformed token structure.' };
  }

  const [encodedPayload, providedSignature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(encodedPayload)
    .digest('base64url');

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
  ) {
    return { isValid: false, error: 'Cryptographic signature verification failed (Tampered token).' };
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as TicketTokenPayload;

    // Check expiration timestamp
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { isValid: false, payload, error: 'Ticket token has expired.' };
    }

    return { isValid: true, payload };
  } catch {
    return { isValid: false, error: 'Failed to decode ticket payload.' };
  }
}

/**
 * Generates high-definition QR Code Data URL from the signed token.
 */
export async function generateQrCodeDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 8,
    color: {
      dark: '#1a2129', // surface-dark from design.md
      light: '#ffffff',
    },
  });
}
