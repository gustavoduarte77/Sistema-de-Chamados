import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChamadosModule } from './chamados/chamados.module.js';
import { PessoasModule } from './pessoas/pessoas.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TiposProblemaModule } from './tipos-problema/tipos-problema.module.js';

@Module({
  imports: [ConfigModule.forRoot(), PrismaModule, PessoasModule, TiposProblemaModule, ChamadosModule],
})
export class AppModule {}
