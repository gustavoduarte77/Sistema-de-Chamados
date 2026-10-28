import { Module } from '@nestjs/common';
import { ChamadosController } from './chamados.controller.js';
import { ChamadosService } from './chamados.service.js';

@Module({ controllers: [ChamadosController], providers: [ChamadosService] })
export class ChamadosModule {}
