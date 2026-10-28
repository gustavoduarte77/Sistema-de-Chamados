import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let app: INestApplication;
let api: ReturnType<typeof request>;
let prisma: any;

beforeAll(async () => {
  // Precisa vir antes de instanciar o PrismaService.
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { AppModule } = await import('../src/app.module.js');
  const { configurar } = await import('../src/setup.js');
  const { PrismaService } = await import('../src/prisma/prisma.service.js');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  configurar(app);
  await app.init();
  api = request(app.getHttpServer());
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await prisma.comentario.deleteMany();
  await prisma.atribuicao.deleteMany();
  await prisma.chamado.deleteMany();
  await prisma.pessoa.deleteMany();
  await prisma.tipoProblema.deleteMany();
});

const pessoa = async (tipo: string, email: string, extra: object = {}) =>
  (await api.post('/pessoas').send({ nome: 'Fulano', email, tipo, ...extra })).body;
const tipoProblema = async (nome = 'Rede', extra: object = {}) =>
  (await api.post('/tipos-problema').send({ nome, ...extra })).body;

async function cenario() {
  const sol = await pessoa('solicitante', 'sol@x.com');
  const tec = await pessoa('tecnico', 'tec@x.com');
  const tp = await tipoProblema();
  return { sol, tec, tp };
}

const abrir = (solicitanteId: number, tipoProblemaId: number, extra: object = {}) =>
  api
    .post('/chamados')
    .send({ solicitanteId, tipoProblemaId, titulo: 'Sem internet', descricao: 'A rede caiu no setor', ...extra });

const situacao = (id: number, s: string) => api.put(`/chamados/${id}/situacao`).send({ situacao: s });
const designar = (id: number, tecnicoId: number) => api.put(`/chamados/${id}/tecnico`).send({ tecnicoId });
const comentar = (id: number, autorId: number, texto: unknown = 'olá') =>
  api.post(`/chamados/${id}/comentarios`).send({ autorId, texto });

describe('pessoas (regras 1-4)', () => {
  it('rejeita e-mail duplicado (case-insensitive) e inválido', async () => {
    await pessoa('tecnico', 'a@x.com');
    expect((await api.post('/pessoas').send({ nome: 'B', email: 'A@X.com', tipo: 'tecnico' })).status).toBe(409);
    expect((await api.post('/pessoas').send({ nome: 'B', email: 'invalido', tipo: 'tecnico' })).status).toBe(400);
  });

  it('rejeita tipo diferente de solicitante/técnico', async () => {
    const r = await api.post('/pessoas').send({ nome: 'B', email: 'b@x.com', tipo: 'gerente' });
    expect(r.status).toBe(400);
  });

  it('pessoa inativa não abre chamado nem é designada nem comenta', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    await api.patch(`/pessoas/${tec.id}`).send({ ativo: false });
    await api.patch(`/pessoas/${sol.id}`).send({ ativo: false });

    expect((await abrir(sol.id, tp.id)).status).toBe(422);
    const sol2 = await pessoa('solicitante', 's2@x.com');
    const c2 = (await abrir(sol2.id, tp.id)).body;
    expect((await designar(c2.id, tec.id)).status).toBe(422);
    expect((await comentar(c.id, tec.id)).status).toBe(422);
  });

  it('não remove quem esteve envolvido, só quem nunca participou', async () => {
    const { sol, tec, tp } = await cenario();
    const livre = await pessoa('tecnico', 'livre@x.com');
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    expect((await api.delete(`/pessoas/${sol.id}`)).status).toBe(409);
    expect((await api.delete(`/pessoas/${tec.id}`)).status).toBe(409);
    expect((await api.delete(`/pessoas/${livre.id}`)).status).toBe(204);
  });

  it('técnico trocado no chamado continua "envolvido" (histórico de atribuições)', async () => {
    const { sol, tec, tp } = await cenario();
    const tec2 = await pessoa('tecnico', 'tec2@x.com');
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    await designar(c.id, tec2.id);
    expect((await api.get(`/chamados/${c.id}`)).body.tecnicoId).toBe(tec2.id);
    expect((await api.delete(`/pessoas/${tec.id}`)).status).toBe(409);
  });

  it('quem só comentou também não é removido', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    await comentar(c.id, tec.id);
    await situacao(c.id, 'cancelado');
    expect((await api.delete(`/pessoas/${tec.id}`)).status).toBe(409);
  });
});

describe('tipos de problema (regras 5-7)', () => {
  it('nome não pode repetir', async () => {
    await tipoProblema('Rede');
    expect((await api.post('/tipos-problema').send({ nome: 'rede' })).status).toBe(409);
  });

  it('não abre chamado em tipo desativado', async () => {
    const sol = await pessoa('solicitante', 'sol@x.com');
    const tp = await tipoProblema('Impressora', { ativo: false });
    expect((await abrir(sol.id, tp.id)).status).toBe(422);
  });

  it('tipo usado não é removido; tipo sem uso é', async () => {
    const { sol, tp } = await cenario();
    const sem = await tipoProblema('Acesso');
    await abrir(sol.id, tp.id);
    expect((await api.delete(`/tipos-problema/${tp.id}`)).status).toBe(409);
    expect((await api.delete(`/tipos-problema/${sem.id}`)).status).toBe(204);
  });
});

describe('abertura de chamado (regras 8-11)', () => {
  it('nasce aberto, sem técnico, com prioridade média por padrão', async () => {
    const { sol, tp } = await cenario();
    const r = await abrir(sol.id, tp.id);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ situacao: 'aberto', tecnicoId: null, prioridade: 'media', resolvidoEm: null });
  });

  it('exige solicitante (não técnico)', async () => {
    const { tec, tp } = await cenario();
    expect((await abrir(tec.id, tp.id)).status).toBe(422);
  });

  it('valida limites de título e descrição', async () => {
    const { sol, tp } = await cenario();
    expect((await abrir(sol.id, tp.id, { titulo: 'abcd' })).status).toBe(400);
    expect((await abrir(sol.id, tp.id, { titulo: 'a'.repeat(101) })).status).toBe(400);
    expect((await abrir(sol.id, tp.id, { titulo: 'a'.repeat(100) })).status).toBe(201);
    expect((await abrir(sol.id, tp.id, { titulo: 'abcde' })).status).toBe(201);
    expect((await abrir(sol.id, tp.id, { descricao: 'curta' })).status).toBe(400);
  });

  it('valida prioridade', async () => {
    const { sol, tp } = await cenario();
    expect((await abrir(sol.id, tp.id, { prioridade: 'urgente' })).status).toBe(400);
    expect((await abrir(sol.id, tp.id, { prioridade: 'critica' })).body.prioridade).toBe('critica');
  });
});

describe('designação e fluxo (regras 12-18)', () => {
  it('designar técnico inicia o atendimento automaticamente', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    const r = await designar(c.id, tec.id);
    expect(r.body).toMatchObject({ situacao: 'em_atendimento', tecnicoId: tec.id });
  });

  it('só técnico pode ser designado', async () => {
    const { sol, tp } = await cenario();
    const outro = await pessoa('solicitante', 'o@x.com');
    const c = (await abrir(sol.id, tp.id)).body;
    expect((await designar(c.id, outro.id)).status).toBe(422);
  });

  it('percorre aberto → em atendimento → resolvido → fechado e registra resolução', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    const res = await situacao(c.id, 'resolvido');
    expect(res.body.resolvidoEm).toBeTruthy();
    expect((await situacao(c.id, 'fechado')).body.situacao).toBe('fechado');
  });

  it('resolvido pode voltar a em atendimento', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    await situacao(c.id, 'resolvido');
    const r = await situacao(c.id, 'em_atendimento');
    expect(r.body).toMatchObject({ situacao: 'em_atendimento', resolvidoEm: null });
  });

  it('aberto e em atendimento podem ser cancelados', async () => {
    const { sol, tec, tp } = await cenario();
    const a = (await abrir(sol.id, tp.id)).body;
    const b = (await abrir(sol.id, tp.id)).body;
    await designar(b.id, tec.id);
    expect((await situacao(a.id, 'cancelado')).body.situacao).toBe('cancelado');
    expect((await situacao(b.id, 'cancelado')).body.situacao).toBe('cancelado');
  });

  it('proíbe caminhos fora do fluxo', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    expect((await situacao(c.id, 'resolvido')).status).toBe(422);
    expect((await situacao(c.id, 'fechado')).status).toBe(422);
    expect((await situacao(c.id, 'em_atendimento')).status).toBe(422); // sem técnico
    await designar(c.id, tec.id);
    expect((await situacao(c.id, 'fechado')).status).toBe(422);
    expect((await situacao(c.id, 'aberto')).status).toBe(422);
    await situacao(c.id, 'resolvido');
    expect((await situacao(c.id, 'cancelado')).status).toBe(422);
    expect((await situacao(c.id, 'inexistente')).status).toBe(400);
  });

  it('chamados fechados/cancelados não mudam nem recebem comentários', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    await situacao(c.id, 'resolvido');
    await situacao(c.id, 'fechado');
    expect((await situacao(c.id, 'em_atendimento')).status).toBe(422);
    expect((await api.patch(`/chamados/${c.id}`).send({ titulo: 'Novo título' })).status).toBe(422);
    expect((await designar(c.id, tec.id)).status).toBe(422);
    expect((await comentar(c.id, sol.id)).status).toBe(422);

    const c2 = (await abrir(sol.id, tp.id)).body;
    await situacao(c2.id, 'cancelado');
    expect((await comentar(c2.id, sol.id)).status).toBe(422);
  });

  it('técnico não pode ter mais de 5 chamados em atendimento', async () => {
    const { sol, tec, tp } = await cenario();
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) ids.push((await abrir(sol.id, tp.id)).body.id);
    for (let i = 0; i < 5; i++) expect((await designar(ids[i], tec.id)).status).toBe(200);
    const r = await designar(ids[5], tec.id);
    expect(r.status).toBe(422);
    expect(r.body.regra).toBe(17);

    await situacao(ids[0], 'resolvido'); // libera vaga
    expect((await designar(ids[5], tec.id)).status).toBe(200);
    expect((await situacao(ids[0], 'em_atendimento')).status).toBe(422); // reabrir estouraria o limite
  });

  it('limite de 5 vale mesmo com designações simultâneas', async () => {
    const { sol, tec, tp } = await cenario();
    const ids: number[] = [];
    for (let i = 0; i < 8; i++) ids.push((await abrir(sol.id, tp.id)).body.id);
    const respostas = await Promise.all(ids.map((id) => designar(id, tec.id)));
    expect(respostas.filter((r) => r.status === 200)).toHaveLength(5);
    expect(respostas.filter((r) => r.status === 422)).toHaveLength(3);
    expect((await api.get(`/chamados?situacao=em_atendimento&tecnicoId=${tec.id}`)).body).toHaveLength(5);
  });

  it('ninguém atende o próprio chamado', async () => {
    const { sol, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    expect((await api.patch(`/pessoas/${sol.id}`).send({ tipo: 'tecnico' })).status).toBe(422);
    expect((await designar(c.id, sol.id)).status).toBe(422);
  });
});

describe('comentários (regras 19-21)', () => {
  it('só solicitante e técnico responsável comentam', async () => {
    const { sol, tec, tp } = await cenario();
    const outroTec = await pessoa('tecnico', 'outro@x.com');
    const c = (await abrir(sol.id, tp.id)).body;

    expect((await comentar(c.id, tec.id)).status).toBe(422); // ainda não é responsável
    await designar(c.id, tec.id);
    expect((await comentar(c.id, sol.id)).status).toBe(201);
    expect((await comentar(c.id, tec.id)).status).toBe(201);
    expect((await comentar(c.id, outroTec.id)).status).toBe(422);
  });

  it('não aceita comentário vazio', async () => {
    const { sol, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    for (const texto of ['', '   ', undefined, 123]) {
      // chamada direta: o helper `comentar` troca undefined por um texto padrão
      expect((await api.post(`/chamados/${c.id}/comentarios`).send({ autorId: sol.id, texto })).status).toBe(400);
    }
  });

  it('comentários são imutáveis (sem rota de edição/remoção)', async () => {
    const { sol, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    const m = (await comentar(c.id, sol.id, 'oi')).body;
    expect((await api.patch(`/chamados/${c.id}/comentarios/${m.id}`).send({ texto: 'x' })).status).toBe(404);
    expect((await api.delete(`/chamados/${c.id}/comentarios/${m.id}`)).status).toBe(404);
    expect((await api.get(`/chamados/${c.id}`)).body.comentarios[0].texto).toBe('oi');
  });
});

describe('consultas', () => {
  it('detalha chamado com a conversa em ordem', async () => {
    const { sol, tec, tp } = await cenario();
    const c = (await abrir(sol.id, tp.id)).body;
    await designar(c.id, tec.id);
    await comentar(c.id, sol.id, 'primeiro');
    await comentar(c.id, tec.id, 'segundo');
    const r = await api.get(`/chamados/${c.id}`);
    expect(r.body.comentarios.map((m: any) => m.texto)).toEqual(['primeiro', 'segundo']);
    expect((await api.get('/chamados/999999')).status).toBe(404);
  });

  it('filtra por situação, prioridade, tipo e técnico', async () => {
    const { sol, tec, tp } = await cenario();
    const tp2 = await tipoProblema('Acesso');
    const a = (await abrir(sol.id, tp.id, { prioridade: 'alta' })).body;
    const b = (await abrir(sol.id, tp2.id, { prioridade: 'baixa' })).body;
    await designar(a.id, tec.id);

    const ids = async (qs: string) => (await api.get(`/chamados?${qs}`)).body.map((c: any) => c.id);
    expect(await ids('')).toEqual([a.id, b.id]);
    expect(await ids('situacao=aberto')).toEqual([b.id]);
    expect(await ids('situacao=em_atendimento')).toEqual([a.id]);
    expect(await ids('prioridade=baixa')).toEqual([b.id]);
    expect(await ids(`tipoProblemaId=${tp2.id}`)).toEqual([b.id]);
    expect(await ids(`tecnicoId=${tec.id}`)).toEqual([a.id]);
    expect(await ids(`tecnicoId=${tec.id}&prioridade=baixa`)).toEqual([]);
    expect((await api.get('/chamados?situacao=xyz')).status).toBe(400);
    expect((await api.get('/chamados?tecnicoId=abc')).status).toBe(400);
  });
});
