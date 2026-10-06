import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { createLogger } from '../../utils/logger';
import type { AuthRepository, UserWithRoles } from './auth.repository';
import type {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleAuthDto,
  UpdateProfileDto,
  ChangePasswordDto,
  SelfRegisterableRole,
} from './auth.dto';
import type { JwtPayload, RoleName } from '../../types';

const log = createLogger('AuthService');

// Memory store for password reset tokens in development/test
const resetTokensStore = new Map<string, { userId: string; expiresAt: number }>();

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: RoleName[];
  };
  tokens: AuthTokens;
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  private extractRoles(user: UserWithRoles): RoleName[] {
    return user.userRoles.map((ur) => ur.role.name);
  }

  private generateTokenPair(user: UserWithRoles): AuthTokens {
    const roles = this.extractRoles(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn as unknown as number,
    });

    const refreshToken = jwt.sign({ sub: user.id }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as unknown as number,
    });

    return { accessToken, refreshToken };
  }

  private formatUserResponse(user: UserWithRoles) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      departmentId: user.departmentId,
      roles: this.extractRoles(user),
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw AppError.conflict('User with this email already exists');
    }

    if (dto.departmentId) {
      const validDept = await this.repo.departmentExists(dto.departmentId);
      if (!validDept) {
        throw AppError.validationError('Invalid department selected', [
          { path: ['departmentId'], message: 'Department not found' },
        ]);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.repo.createUserWithRole(dto, passwordHash);
    const tokens = this.generateTokenPair(user);

    // Save refresh token to DB for rotation tracking
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.saveRefreshToken(user.id, tokens.refreshToken, refreshExpiresAt);

    log.info(`User registered successfully: ${user.id} (${user.email})`);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  async getRegisterOptions(): Promise<{
    roles: Array<{ value: SelfRegisterableRole; label: string }>;
    departments: Array<{ id: string; name: string; code: string }>;
  }> {
    const departments = await this.repo.listActiveDepartments();
    return {
      roles: [
        { value: 'STUDENT', label: 'Student' },
        { value: 'FACULTY', label: 'Faculty' },
        { value: 'MAINTENANCE_STAFF', label: 'Maintenance Staff' },
        { value: 'SECURITY_STAFF', label: 'Security Staff' },
      ],
      departments,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.repo.findByEmail(dto.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Account has been deactivated');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const tokens = this.generateTokenPair(user);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.saveRefreshToken(user.id, tokens.refreshToken, refreshExpiresAt);

    log.info(`User logged in: ${user.id}`);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  async refreshToken(rawRefreshToken: string): Promise<AuthTokens> {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    let payload: { sub: string };
    try {
      payload = jwt.verify(rawRefreshToken, config.jwt.refreshSecret) as { sub: string };
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Verify token exists in DB (RefreshToken Rotation)
    const tokenRecord = await this.repo.findRefreshToken(rawRefreshToken);
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      // Security measure: if reused or invalid, revoke all tokens for this user
      if (payload.sub) {
        await this.repo.deleteAllUserRefreshTokens(payload.sub);
      }
      throw AppError.unauthorized('Refresh token revoked or expired');
    }

    const user = await this.repo.findById(payload.sub);
    if (!user || !user.isActive) {
      throw AppError.unauthorized('User not found or deactivated');
    }

    // Revoke old refresh token & issue new pair
    await this.repo.deleteRefreshToken(rawRefreshToken);
    const newTokens = this.generateTokenPair(user);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.saveRefreshToken(user.id, newTokens.refreshToken, refreshExpiresAt);

    log.info(`Refresh token rotated for user: ${user.id}`);

    return newTokens;
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.repo.deleteRefreshToken(refreshToken);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.repo.findByEmail(dto.email);
    if (!user) {
      // Standard security practice: return success message even if email doesn't exist
      return { message: 'If an account exists with that email, a reset link has been sent.' };
    }

    const resetToken = jwt.sign({ sub: user.id, action: 'password_reset' }, config.jwt.accessSecret, {
      expiresIn: '1h',
    });

    resetTokensStore.set(resetToken, {
      userId: user.id,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    log.info(`Password reset token generated for user ${user.id}: ${resetToken}`);

    return {
      message: 'If an account exists with that email, a reset link has been sent.',
      // Included in development for easy testing
      resetToken: config.isProduction ? undefined : resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    let payload: { sub: string; action: string };
    try {
      payload = jwt.verify(dto.token, config.jwt.accessSecret) as { sub: string; action: string };
    } catch {
      throw AppError.badRequest('Invalid or expired reset token');
    }

    if (payload.action !== 'password_reset') {
      throw AppError.badRequest('Invalid reset token type');
    }

    const stored = resetTokensStore.get(dto.token);
    if (!stored || stored.expiresAt < Date.now()) {
      throw AppError.badRequest('Reset token has expired or already been used');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.repo.updatePassword(payload.sub, newPasswordHash);
    await this.repo.deleteAllUserRefreshTokens(payload.sub);
    resetTokensStore.delete(dto.token);

    log.info(`Password reset successfully for user: ${payload.sub}`);
  }

  async googleLogin(dto: GoogleAuthDto): Promise<AuthResponse> {
    if (config.isProduction) {
      throw AppError.forbidden(
        'Google sign-in is not configured for production. Set GOOGLE_CLIENT_ID and GOOGLE_AUTH_ENABLED after implementing OAuth verification.',
      );
    }

    // Development-only mock OAuth — never use in production
    if (!dto.idToken) {
      throw AppError.badRequest('Google ID token is required');
    }

    // Decode or simulate token payload
    const mockEmail = 'google.user@campusverse.edu';
    let user = await this.repo.findByEmail(mockEmail);

    if (!user) {
      user = await this.repo.createUserWithRole(
        {
          email: mockEmail,
          password: await bcrypt.hash(Math.random().toString(36), 10),
          firstName: 'Google',
          lastName: 'User',
          roleName: 'FACULTY',
        },
        'OAUTH_USER_NO_PASSWORD',
      );
    }

    const tokens = this.generateTokenPair(user);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.saveRefreshToken(user.id, tokens.refreshToken, refreshExpiresAt);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw AppError.notFound('User');
    return this.formatUserResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.repo.findById(userId);
    if (!user) throw AppError.notFound('User');
    if (!user.isActive) throw AppError.forbidden('Account has been deactivated');

    const updated = await this.repo.updateProfile(userId, {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
    });
    log.info(`Profile updated for user: ${userId}`);
    return this.formatUserResponse(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) throw AppError.notFound('User');
    if (!user.isActive) throw AppError.forbidden('Account has been deactivated');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);
    await this.repo.updatePassword(userId, newPasswordHash);
    await this.repo.deleteAllUserRefreshTokens(userId);
    log.info(`Password changed for user: ${userId}`);
  }
}
