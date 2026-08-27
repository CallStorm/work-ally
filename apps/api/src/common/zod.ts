import { BadRequestException } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod';
import { ZodError } from 'zod';

export function parseBody<
  Output,
  Def extends ZodTypeDef = ZodTypeDef,
  Input = Output,
>(schema: ZodType<Output, Def, Input>, raw: unknown): Output {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BadRequestException(formatZodError(result.error));
  }
  return result.data;
}

export function formatZodError(error: ZodError): string {
  return error.errors.map((e) => e.message).join('；') || '请求参数无效';
}
