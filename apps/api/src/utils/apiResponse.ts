import { Response } from 'express';

// ----- Success -----

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta: Record<string, unknown> = {},
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta,
  } satisfies ApiSuccessResponse<T>);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, {}, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
): void {
  res.status(200).json({
    success: true,
    data,
    meta: { pagination },
  });
}

// ----- Error -----

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}
