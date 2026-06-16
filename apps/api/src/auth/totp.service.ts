import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * TOTP (Time-based One-Time Password) implementation for 2FA
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator
 */
@Injectable()
export class TotpService {
  private readonly WINDOW = 30; // Time window in seconds
  private readonly DIGITS = 6;

  /**
   * Generate a new secret for TOTP
   * Returns base32-encoded secret that can be converted to QR code
   */
  generateSecret(): string {
    const bytes = randomBytes(32);
    return this.base32Encode(bytes);
  }

  /**
   * Get current TOTP code for verification
   */
  getCurrentCode(secret: string): string {
    const now = Math.floor(Date.now() / 1000);
    return this.generateCode(secret, Math.floor(now / this.WINDOW));
  }

  /**
   * Verify a TOTP code
   * Allows for time window drift (±1 window = ±30 seconds)
   */
  verifyCode(secret: string, code: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const timeCounter = Math.floor(now / this.WINDOW);

    // Check current window and ±1 for drift tolerance
    for (let i = -1; i <= 1; i++) {
      const expectedCode = this.generateCode(secret, timeCounter + i);
      const expected = Buffer.from(expectedCode, 'utf8');
      const received = Buffer.from(code, 'utf8');
      if (expected.length === received.length && timingSafeEqual(expected, received)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate provisioning URL for QR code
   * Format compatible with Google Authenticator
   */
  getProvisioningUrl(secret: string, email: string, issuer: string = 'Ajust ERP'): string {
    const encoded = encodeURIComponent(secret);
    const encodedEmail = encodeURIComponent(email);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encoded}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${this.DIGITS}&period=${this.WINDOW}`;
  }

  private generateCode(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    for (let i = 7; i >= 0; i--) {
      buffer[i] = counter & 0xff;
      counter = counter >> 8;
    }

    const secretBuffer = this.base32Decode(secret);
    const hmac = require('crypto').createHmac('sha1', secretBuffer);
    const hash = hmac.update(buffer).digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const code =
      (((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)) %
      Math.pow(10, this.DIGITS);

    return String(code).padStart(this.DIGITS, '0');
  }

  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let encoded = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        bits -= 5;
        encoded += alphabet[(value >> bits) & 31];
      }
    }

    if (bits > 0) {
      encoded += alphabet[(value << (5 - bits)) & 31];
    }

    while (encoded.length % 8 !== 0) {
      encoded += '=';
    }

    return encoded;
  }

  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < encoded.length; i++) {
      const char = encoded[i];
      if (char === '=') break;

      const index = alphabet.indexOf(char.toUpperCase());
      if (index === -1) throw new Error('Invalid base32 character');

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        bits -= 8;
        output.push((value >> bits) & 255);
      }
    }

    return Buffer.from(output);
  }
}
