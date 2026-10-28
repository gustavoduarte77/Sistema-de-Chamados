import { Injectable } from '@nestjs/common';
import { conflito, naoEncontrado } from '../common/domain-error.js';
import { isPrismaCode } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarTipoProblemaDto, CriarTipoProblemaDto } from './tipos-problema.dto.js';

const NOME_DUPLICADO = 'Já existe um tipo de problema com esse nome.';
const EM_USO = 'Tipo de problema já usado em chamados; apenas desative-o.';

// O índice único do MySQL (collation *_ci) já ignora maiúsculas/minúsculas no nome.
@Injectable()
export class TiposProblemaService {
  constructor(private prisma: PrismaService) {}

  async criar(d: CriarTipoProblemaDto) {
    try {
      return await this.prisma.tipoProblema.create({ data: { nome: d.nome, ativo: d.ativo ?? true } });
    } catch (e) {
      if (isPrismaCode(e, 'P2002')) throw conflito(NOME_DUPLICADO, 5);
      throw e;
    }
  }

  async obter(id: number) {
    const t = await this.prisma.tipoProblema.findUnique({ where: { id } });
    if (!t) throw naoEncontrado('Tipo de problema não encontrado.');
    return t;
  }

  listar() {
    return this.prisma.tipoProblema.findMany({ orderBy: { id: 'asc' } });
  }

  async atualizar(id: number, d: AtualizarTipoProblemaDto) {
    await this.obter(id);
    try {
      return await this.prisma.tipoProblema.update({ where: { id }, data: { nome: d.nome, ativo: d.ativo } });
    } catch (e) {
      if (isPrismaCode(e, 'P2002')) throw conflito(NOME_DUPLICADO, 5);
      throw e;
    }
  }

  async remover(id: number): Promise<void> {
    await this.obter(id);
    if ((await this.prisma.chamado.count({ where: { tipoProblemaId: id } })) > 0) throw conflito(EM_USO, 7);
    try {
      await this.prisma.tipoProblema.delete({ where: { id } });
    } catch (e) {
      if (isPrismaCode(e, 'P2003')) throw conflito(EM_USO, 7);
      throw e;
    }
  }
}
