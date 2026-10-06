import { z } from 'zod';

/** Roles allowed via public self-registration (admins are created by existing admins only). */
export const selfRegisterableRoles = [
  'STUDENT',
  'FACULTY',
  'MAINTENANCE_STAFF',
  'SECURITY_STAFF',
] as const;

export type SelfRegisterableRole = (typeof selfRegisterableRoles)[number];

export const registerSchema = z.object({
  body: z
    .object({
      email: z.string().email('Invalid email address').toLowerCase().trim(),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be at most 100 characters'),
      firstName: z.string().min(1, 'First name is required').max(50),
      lastName: z.string().min(1, 'Last name is required').max(50),
      roleName: z.enum(selfRegisterableRoles).optional().default('STUDENT'),
      departmentId: z.string().uuid('Invalid department').optional(),
    })
    .superRefine((data, ctx) => {
      if (['STUDENT', 'FACULTY'].includes(data.roleName) && !data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: 'Department is required for student and faculty accounts',
          path: ['departmentId'],
        });
      }
    }),
});

export type RegisterDto = z.infer<typeof registerSchema>['body'];

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export type LoginDto = z.infer<typeof loginSchema>['body'];

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>['body'];

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
  }),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>['body'];

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100),
  }),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>['body'];

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'Google ID token is required'),
  }),
});

export type GoogleAuthDto = z.infer<typeof googleAuthSchema>['body'];

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
  }).refine((val) => val.firstName !== undefined || val.lastName !== undefined, {
    message: 'At least one field (firstName or lastName) is required',
  }),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>['body'];

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be at most 100 characters'),
  }),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>['body'];
