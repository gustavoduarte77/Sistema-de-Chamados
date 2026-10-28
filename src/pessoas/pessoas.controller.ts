import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AtualizarPessoaDto, CriarPessoaDto } from './pessoas.dto.js';
import { PessoasService } from './pessoas.service.js';

@Controller('pessoas')
export class PessoasController {
  constructor(private service: PessoasService) {}

  @Post() criar(@Body() d: CriarPessoaDto) {
    return this.service.criar(d);
  }

  @Get() listar() {
    return this.service.listar();
  }

  @Get(':id') obter(@Param('id', ParseIntPipe) id: number) {
    return this.service.obter(id);
  }

  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() d: AtualizarPessoaDto) {
    return this.service.atualizar(id, d);
  }

  @Delete(':id') @HttpCode(204) remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
