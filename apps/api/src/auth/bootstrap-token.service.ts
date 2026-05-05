import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

/**
 * Bootstrap Token Service
 * Generates secure temporary tokens for first-time client access
 * Replaces weak CNPJ-based passwords
 */
@Injectable()
export class BootstrapTokenService {
  /**
   * Generate a secure bootstrap token
   * Format: random 32-byte token encoded as hex
   * Returns both the token and its hash for secure storage
   */
  generateToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('hex');
    const hash = this.hashToken(token);
    return { token, hash };
  }

  /**
   * Hash a bootstrap token for secure storage
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify a bootstrap token against its hash
   */
  verifyToken(token: string, hash: string): boolean {
    return this.hashToken(token) === hash;
  }

  /**
   * Generate a bootstrap token with expiry information
   */
  generateTokenWithExpiry(expiryHours: number = 1): {
    token: string;
    hash: string;
    expiresAt: Date;
  } {
    const { token, hash } = this.generateToken();
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    return { token, hash, expiresAt };
  }

  /**
   * Check if a bootstrap token has expired
   */
  isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Format token for display (first 8 + last 8 chars)
   */
  formatTokenForDisplay(token: string): string {
    const first = token.substring(0, 8);
    const last = token.substring(token.length - 8);
    return `${first}...${last}`;
  }
}
