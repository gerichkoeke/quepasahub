import crypto from 'crypto';

/**
 * Generate a secure random webhook token
 * @returns Hex-encoded token (64 characters)
 */
export function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
