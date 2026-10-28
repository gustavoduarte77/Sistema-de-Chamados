import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DomainErrorFilter } from './common/domain-error.filter.js';

/** Configuração comum à aplicação real e aos testes e2e. */
export function configurar(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainErrorFilter());
}
