import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';
import type { AuthService } from './auth.service';
import type {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleAuthDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './auth.dto';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.body as RegisterDto);
      this.setRefreshTokenCookie(res, result.tokens.refreshToken);
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  };

  registerOptions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const options = await this.service.getRegisterOptions();
      sendSuccess(res, options);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body as LoginDto);
      this.setRefreshTokenCookie(res, result.tokens.refreshToken);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = (req.body as { refreshToken?: string }).refreshToken || req.cookies['refreshToken'];
      const tokens = await this.service.refreshToken(token);
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      sendSuccess(res, tokens);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = (req.body as { refreshToken?: string }).refreshToken || req.cookies['refreshToken'];
      await this.service.logout(token);
      res.clearCookie('refreshToken');
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.forgotPassword(req.body as ForgotPasswordDto);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.resetPassword(req.body as ResetPasswordDto);
      sendSuccess(res, { message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  };

  google = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.googleLogin(req.body as GoogleAuthDto);
      this.setRefreshTokenCookie(res, result.tokens.refreshToken);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.getCurrentUser(req.user!.sub);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.updateProfile(req.user!.sub, req.body as UpdateProfileDto);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.changePassword(req.user!.sub, req.body as ChangePasswordDto);
      res.clearCookie('refreshToken');
      sendSuccess(res, { message: 'Password changed successfully. Please log in again.' });
    } catch (err) {
      next(err);
    }
  };

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
