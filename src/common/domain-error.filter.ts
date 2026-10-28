import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from './domain-error.js';

/** Padroniza as respostas de erro: { erro, tipo, regra? }. */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (err instanceof DomainError) {
      return res.status(err.status).json({ erro: err.message, tipo: err.kind, regra: err.regra });
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse() as any;
      const msg = Array.isArray(body?.message) ? body.message.join(' ') : (body?.message ?? err.message);
      const tipo = status === 404 ? 'nao_encontrado' : status < 500 ? 'validacao' : 'interno';
      return res.status(status).json({ erro: msg, tipo });
    }
    this.log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    return res.status(500).json({ erro: 'Erro interno.', tipo: 'interno' });
  }
}
