import { Prisma } from '../generated/prisma/client.js';

export const isPrismaCode = (e: unknown, code: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
