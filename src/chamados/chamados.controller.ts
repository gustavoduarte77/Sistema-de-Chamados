import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  AbrirChamadoDto,
  AtualizarChamadoDto,
  ComentarDto,
  DesignarTecnicoDto,
  ListarChamadosQuery,
  MudarSituacaoDto,
} from './chamados.dto.js';
import { ChamadosService } from './chamados.service.js';

// Comentários não têm rotas de edição/remoção: são imutáveis (regra 21).
@Controller('chamados')
export class ChamadosController {
  constructor(private service: ChamadosService) {}

  @Post() abrir(@Body() d: AbrirChamadoDto) {
    return this.service.abrir(d);
  }

  @Get() listar(@Query() q: ListarChamadosQuery) {
    return this.service.listar(q);
  }

  @Get(':id') detalhar(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhar(id);
  }

  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() d: AtualizarChamadoDto) {
    return this.service.atualizar(id, d);
  }

  @Put(':id/tecnico') designar(@Param('id', ParseIntPipe) id: number, @Body() d: DesignarTecnicoDto) {
    return this.service.designar(id, d.tecnicoId);
  }

  @Put(':id/situacao') mudarSituacao(@Param('id', ParseIntPipe) id: number, @Body() d: MudarSituacaoDto) {
    return this.service.mudarSituacao(id, d.situacao);
  }

  @Post(':id/comentarios') comentar(@Param('id', ParseIntPipe) id: number, @Body() d: ComentarDto) {
    return this.service.comentar(id, d);
  }
}
