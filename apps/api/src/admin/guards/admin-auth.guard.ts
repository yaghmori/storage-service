import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { AdminJwtService } from '../services/admin-jwt.service';
import { AdminUserService } from '../services/admin-user.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: AdminJwtService,
    private readonly adminUserService: AdminUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Valid admin JWT token required');
    }

    const token = authHeader.substring(7);
    const payload = this.jwtService.verifyAdminJWT(token);

    if (!payload || !payload.adminId) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    // Verify admin user still exists and is active
    const adminUser = await this.adminUserService.findById(payload.adminId);
    if (!adminUser || !adminUser.isActive) {
      throw new UnauthorizedException('Admin user not found or inactive');
    }

    request.adminId = payload.adminId;
    request.adminEmail = payload.email;
    request.adminRole = payload.role;
    request.user = {
      adminId: payload.adminId,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }
}
