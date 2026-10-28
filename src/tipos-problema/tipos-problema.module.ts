import { Module } from '@nestjs/common';
import { TiposProblemaController } from './tipos-problema.controller.js';
import { TiposProblemaService } from './tipos-problema.service.js';

@Module({ controllers: [TiposProblemaController], providers: [TiposProblemaService] })
export class TiposProblemaModule {}
