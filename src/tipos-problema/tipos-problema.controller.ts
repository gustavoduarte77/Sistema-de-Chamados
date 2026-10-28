import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AtualizarTipoProblemaDto, CriarTipoProblemaDto } from './tipos-problema.dto.js';
import { TiposProblemaService } from './tipos-problema.service.js';

@Controller('tipos-problema')
export class TiposProblemaController {
  constructor(private service: TiposProblemaService) {}

  @Post() criar(@Body() d: CriarTipoProblemaDto) {
    return this.service.criar(d);
  }

  @Get() listar() {
    return this.service.listar();
  }

  @Get(':id') obter(@Param('id', ParseIntPipe) id: number) {
    return this.service.obter(id);
  }

  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() d: AtualizarTipoProblemaDto) {
    return this.service.atualizar(id, d);
  }

  @Delete(':id') @HttpCode(204) remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
