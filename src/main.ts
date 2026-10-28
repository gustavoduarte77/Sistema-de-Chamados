import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { configurar } from './setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurar(app);
  // Interface web (HTML/JS/CSS estáticos) servida na raiz.
  app.useStaticAssets(join(process.cwd(), 'public'));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Sistema de Chamados em http://localhost:${port}`);
}

bootstrap();
