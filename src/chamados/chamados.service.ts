import { Injectable } from '@nestjs/common';
import { naoEncontrado, regra } from '../common/domain-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { Situacao } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AbrirChamadoDto,
  AtualizarChamadoDto,
  ComentarDto,
  ListarChamadosQuery,
} from './chamados.dto.js';

export const MAX_EM_ATENDIMENTO = 5;

type Tx = Prisma.TransactionClient;

const TRANSICOES: Record<Situacao, Situacao[]> = {
  aberto: ['em_atendimento', 'cancelado'],
  em_atendimento: ['resolvido', 'cancelado'],
  resolvido: ['fechado', 'em_atendimento'],
  fechado: [],
  cancelado: [],
};

const encerrado = (s: Situacao) => s === 'fechado' || s === 'cancelado';

@Injectable()
export class ChamadosService {
  constructor(private prisma: PrismaService) {}

  // Travas de linha: serializam operações concorrentes sobre o mesmo chamado/técnico
  // (necessário para o limite de 5 atendimentos e para não comentar em chamado recém-encerrado).
  private async travarChamado(tx: Tx, id: number) {
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM Chamado WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) throw naoEncontrado('Chamado não encontrado.');
  }

  private async travarPessoa(tx: Tx, id: number) {
    await tx.$queryRaw`SELECT id FROM Pessoa WHERE id = ${id} FOR UPDATE`;
  }

  private async carregar(tx: Tx, id: number) {
    await this.travarChamado(tx, id);
    return (await tx.chamado.findUnique({ where: { id } }))!;
  }

  private async garantirLimite(tx: Tx, tecnicoId: number, chamadoId: number) {
    // Leitura com trava (FOR UPDATE): enxerga o estado mais recente confirmado. Um COUNT comum usaria o
    // snapshot da transação e não veria designações concorrentes já confirmadas.
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM Chamado
      WHERE tecnicoId = ${tecnicoId} AND situacao = 'em_atendimento' AND id <> ${chamadoId}
      FOR UPDATE`;
    if (rows.length >= MAX_EM_ATENDIMENTO) {
      throw regra(`Técnico já possui ${MAX_EM_ATENDIMENTO} chamados em atendimento.`, 17);
    }
  }

  async abrir(d: AbrirChamadoDto) {
    const solicitante = await this.prisma.pessoa.findUnique({ where: { id: d.solicitanteId } });
    if (!solicitante) throw naoEncontrado('Solicitante não encontrado.');
    if (solicitante.tipo !== 'solicitante') throw regra('Quem abre o chamado deve ser um solicitante.', 9);
    if (!solicitante.ativo) throw regra('Pessoa inativa não pode abrir chamados.', 3);

    const tipo = await this.prisma.tipoProblema.findUnique({ where: { id: d.tipoProblemaId } });
    if (!tipo) throw naoEncontrado('Tipo de problema não encontrado.');
    if (!tipo.ativo) throw regra('Tipo de problema desativado.', 6);

    return this.prisma.chamado.create({
      data: {
        titulo: d.titulo,
        descricao: d.descricao,
        prioridade: d.prioridade ?? 'media',
        solicitanteId: solicitante.id,
        tipoProblemaId: tipo.id,
      },
    });
  }

  async obter(id: number) {
    const c = await this.prisma.chamado.findUnique({ where: { id } });
    if (!c) throw naoEncontrado('Chamado não encontrado.');
    return c;
  }

  async detalhar(id: number) {
    const c = await this.prisma.chamado.findUnique({
      where: { id },
      include: { comentarios: { orderBy: { id: 'asc' } } },
    });
    if (!c) throw naoEncontrado('Chamado não encontrado.');
    return c;
  }

  listar(f: ListarChamadosQuery) {
    return this.prisma.chamado.findMany({
      where: {
        situacao: f.situacao,
        prioridade: f.prioridade,
        tipoProblemaId: f.tipoProblemaId,
        tecnicoId: f.tecnicoId,
      },
      orderBy: { id: 'asc' },
    });
  }

  atualizar(id: number, d: AtualizarChamadoDto) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.carregar(tx, id);
      if (encerrado(c.situacao)) throw regra('Chamado encerrado não pode ser alterado.', 15);
      return tx.chamado.update({
        where: { id },
        data: { titulo: d.titulo, descricao: d.descricao, prioridade: d.prioridade },
      });
    });
  }

  designar(id: number, tecnicoId: number) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.carregar(tx, id);
      if (encerrado(c.situacao)) throw regra('Chamado encerrado não pode ser alterado.', 15);
      if (c.situacao === 'resolvido') {
        throw regra('Chamado resolvido não aceita nova designação; reabra-o antes.', 14);
      }
      const t = await tx.pessoa.findUnique({ where: { id: tecnicoId } });
      if (!t) throw naoEncontrado('Técnico não encontrado.');
      if (t.tipo !== 'tecnico') throw regra('Apenas técnicos podem ser designados.', 12);
      if (!t.ativo) throw regra('Técnico inativo não pode ser designado.', 3);
      if (t.id === c.solicitanteId) throw regra('Ninguém pode atender o próprio chamado.', 18);
      if (c.tecnicoId === t.id) return c;

      await this.travarPessoa(tx, t.id);
      await this.garantirLimite(tx, t.id, c.id);
      await tx.atribuicao.create({ data: { chamadoId: id, tecnicoId: t.id } });
      return tx.chamado.update({
        where: { id },
        // Regra 13: designar técnico em chamado aberto inicia o atendimento.
        data: { tecnicoId: t.id, situacao: c.situacao === 'aberto' ? 'em_atendimento' : c.situacao },
      });
    });
  }

  mudarSituacao(id: number, para: Situacao) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.carregar(tx, id);
      if (encerrado(c.situacao)) throw regra('Chamado encerrado não pode ser alterado.', 15);
      if (!TRANSICOES[c.situacao].includes(para)) {
        throw regra(`Transição proibida: ${c.situacao} → ${para}.`, 14);
      }
      if (c.situacao === 'aberto' && para === 'em_atendimento') {
        // Só ocorre via designação (regra 13); chamado aberto nunca tem técnico.
        throw regra('Para iniciar o atendimento, designe um técnico.', 13);
      }
      if (c.situacao === 'resolvido' && para === 'em_atendimento' && c.tecnicoId !== null) {
        await this.travarPessoa(tx, c.tecnicoId);
        await this.garantirLimite(tx, c.tecnicoId, c.id);
      }
      return tx.chamado.update({
        where: { id },
        data: {
          situacao: para,
          // Regra 16: registra o momento da resolução; reabrir limpa o registro.
          resolvidoEm: para === 'resolvido' ? new Date() : para === 'em_atendimento' ? null : undefined,
        },
      });
    });
  }

  comentar(id: number, d: ComentarDto) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.carregar(tx, id);
      if (encerrado(c.situacao)) throw regra('Chamado encerrado não pode receber comentários.', 15);
      const autor = await tx.pessoa.findUnique({ where: { id: d.autorId } });
      if (!autor) throw naoEncontrado('Autor não encontrado.');
      if (!autor.ativo) throw regra('Pessoa inativa não pode comentar.', 3);
      if (autor.id !== c.solicitanteId && autor.id !== c.tecnicoId) {
        throw regra('Só o solicitante e o técnico responsável podem comentar.', 19);
      }
      return tx.comentario.create({ data: { chamadoId: id, autorId: autor.id, texto: d.texto } });
    });
  }
}
