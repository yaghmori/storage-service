import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface AdminJWTPayload {
  adminId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AdminJwtService {
  constructor(private readonly configService: ConfigService) {}

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET') || '';
  }

  get jwtIssuer(): string {
    return this.configService.get<string>('JWT_ISSUER') || 'storage-service';
  }

  /** Admin panel JWT lifetime (jsonwebtoken duration string). Default: 365d. */
  get adminJwtExpiresIn(): string {
    return this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') || '365d';
  }

  verifyAdminJWT(token: string): AdminJWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
      }) as AdminJWTPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  generateAdminJWT(
    adminId: string,
    email: string,
    role: string,
    expiresIn = this.adminJwtExpiresIn,
  ): string {
    return jwt.sign(
      { adminId, email, role },
      this.jwtSecret,
      {
        issuer: this.jwtIssuer,
        expiresIn,
      } as jwt.SignOptions
    );
  }
}
