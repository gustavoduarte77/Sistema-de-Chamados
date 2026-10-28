import { Injectable } from '@nestjs/common';
import { conflito, naoEncontrado, regra } from '../common/domain-error.js';
import { isPrismaCode } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarPessoaDto, CriarPessoaDto } from './pessoas.dto.js';

@Injectable()
export class PessoasService {
  constructor(private prisma: PrismaService) {}

  async criar(d: CriarPessoaDto) {
    try {
      return await this.prisma.pessoa.create({
        data: { nome: d.nome, email: d.email.toLowerCase(), tipo: d.tipo, ativo: d.ativo ?? true },
      });
    } catch (e) {
      if (isPrismaCode(e, 'P2002')) throw conflito('E-mail já cadastrado.', 1);
      throw e;
    }
  }

  async obter(id: number) {
    const p = await this.prisma.pessoa.findUnique({ where: { id } });
    if (!p) throw naoEncontrado('Pessoa não encontrada.');
    return p;
  }

  listar() {
    return this.prisma.pessoa.findMany({ orderBy: { id: 'asc' } });
  }

  /** Regra 4: já abriu, atendeu (inclusive em atribuições antigas) ou comentou em algum chamado. */
  private async envolvida(id: number): Promise<boolean> {
    const [abertos, atribuicoes, comentarios] = await Promise.all([
      this.prisma.chamado.count({ where: { OR: [{ solicitanteId: id }, { tecnicoId: id }] } }),
      this.prisma.atribuicao.count({ where: { tecnicoId: id } }),
      this.prisma.comentario.count({ where: { autorId: id } }),
    ]);
    return abertos + atribuicoes + comentarios > 0;
  }

  async atualizar(id: number, d: AtualizarPessoaDto) {
    const atual = await this.obter(id);
    if (d.tipo !== undefined && d.tipo !== atual.tipo && (await this.envolvida(id))) {
      throw regra('Não é possível mudar o tipo de quem já se envolveu em chamados.', 4);
    }
    try {
      return await this.prisma.pessoa.update({
        where: { id },
        data: { nome: d.nome, email: d.email?.toLowerCase(), tipo: d.tipo, ativo: d.ativo },
      });
    } catch (e) {
      if (isPrismaCode(e, 'P2002')) throw conflito('E-mail já cadastrado.', 1);
      throw e;
    }
  }

  async remover(id: number): Promise<void> {
    await this.obter(id);
    if (await this.envolvida(id)) {
      throw conflito('Pessoa já esteve envolvida em chamados; apenas desative-a.', 4);
    }
    try {
      await this.prisma.pessoa.delete({ where: { id } });
    } catch (e) {
      // FK Restrict do banco: rede de segurança contra corrida com a abertura de um chamado.
      if (isPrismaCode(e, 'P2003')) throw conflito('Pessoa já esteve envolvida em chamados; apenas desative-a.', 4);
      throw e;
    }
  }
}
