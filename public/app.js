'use strict';

const SITUACOES = { aberto: 'Aberto', em_atendimento: 'Em atendimento', resolvido: 'Resolvido', fechado: 'Fechado', cancelado: 'Cancelado' };
const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
// aberto -> em_atendimento só ocorre ao designar um técnico (regra 13).
const TRANSICOES = {
  aberto: ['cancelado'],
  em_atendimento: ['resolvido', 'cancelado'],
  resolvido: ['fechado', 'em_atendimento'],
  fechado: [],
  cancelado: [],
};

const estado = { pessoas: [], tipos: [], chamados: [] };
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const badge = (cls, txt) => `<span class="badge b-${cls}">${esc(txt)}</span>`;
const opcoes = (itens, sel) => itens.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`).join('');

let toastTimer;
function aviso(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = erro ? 'erro' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), erro ? 6000 : 2500);
}

async function api(metodo, url, corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.erro || `Erro ${r.status}`);
    e.regra = j.regra;
    throw e;
  }
  return j;
}

// Executa uma ação, mostra o erro da API (com a regra violada) e devolve true se deu certo.
async function tentar(fn, okMsg) {
  try {
    await fn();
    if (okMsg) aviso(okMsg);
    return true;
  } catch (e) {
    aviso(e.regra ? `${e.message} (regra ${e.regra})` : e.message, true);
    return false;
  }
}

const pessoaNome = (id) => estado.pessoas.find((p) => p.id === id)?.nome ?? (id ? `#${id}` : '—');
const tipoNome = (id) => estado.tipos.find((t) => t.id === id)?.nome ?? `#${id}`;

async function carregarBase() {
  [estado.pessoas, estado.tipos] = await Promise.all([api('GET', '/pessoas'), api('GET', '/tipos-problema')]);
}

/* ---------- Modal ---------- */
const modal = $('#modal');
function abrirModal(html) {
  $('#modal-corpo').innerHTML = html;
  if (!modal.open) modal.showModal();
}
function fecharModal() { if (modal.open) modal.close(); }
modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

/* ---------- Abas ---------- */
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('ativa', x === b));
  for (const a of ['chamados', 'pessoas', 'tipos']) $(`#aba-${a}`).hidden = a !== b.dataset.aba;
  renderAba(b.dataset.aba);
}));

async function renderAba(aba) {
  await tentar(carregarBase);
  if (aba === 'chamados') { montarFiltros(); await listarChamados(); }
  if (aba === 'pessoas') renderPessoas();
  if (aba === 'tipos') renderTipos();
}

/* ---------- Chamados ---------- */
function montarFiltros() {
  const f = (id, vazio, itens) => {
    const el = $(id), atual = el.value;
    el.innerHTML = `<option value="">${vazio}</option>${opcoes(itens, atual)}`;
  };
  f('#f-situacao', 'Todas as situações', Object.entries(SITUACOES));
  f('#f-prioridade', 'Todas as prioridades', Object.entries(PRIORIDADES));
  f('#f-tipo', 'Todos os tipos', estado.tipos.map((t) => [t.id, t.nome]));
  f('#f-tecnico', 'Todos os técnicos', estado.pessoas.filter((p) => p.tipo === 'tecnico').map((p) => [p.id, p.nome]));
}
['#f-situacao', '#f-prioridade', '#f-tipo', '#f-tecnico'].forEach((id) => $(id).addEventListener('change', listarChamados));

async function listarChamados() {
  const q = new URLSearchParams();
  for (const [id, k] of [['#f-situacao', 'situacao'], ['#f-prioridade', 'prioridade'], ['#f-tipo', 'tipoProblemaId'], ['#f-tecnico', 'tecnicoId']]) {
    if ($(id).value) q.set(k, $(id).value);
  }
  await tentar(async () => { estado.chamados = await api('GET', `/chamados?${q}`); });
  const corpo = $('#lista-chamados');
  if (!estado.chamados.length) {
    corpo.innerHTML = '<tr><td colspan="8" class="vazio">Nenhum chamado encontrado.</td></tr>';
    return;
  }
  corpo.innerHTML = estado.chamados.map((c) => `
    <tr class="clicavel" data-id="${c.id}">
      <td>${c.id}</td><td>${esc(c.titulo)}</td><td>${esc(tipoNome(c.tipoProblemaId))}</td>
      <td>${badge(c.prioridade, PRIORIDADES[c.prioridade])}</td><td>${badge(c.situacao, SITUACOES[c.situacao])}</td>
      <td>${esc(pessoaNome(c.solicitanteId))}</td><td>${esc(pessoaNome(c.tecnicoId))}</td><td>${data(c.criadoEm)}</td>
    </tr>`).join('');
  corpo.querySelectorAll('tr.clicavel').forEach((tr) => tr.addEventListener('click', () => abrirChamado(Number(tr.dataset.id))));
}

$('#btn-novo-chamado').addEventListener('click', () => {
  const solicitantes = estado.pessoas.filter((p) => p.tipo === 'solicitante' && p.ativo);
  const tipos = estado.tipos.filter((t) => t.ativo);
  if (!solicitantes.length || !tipos.length) {
    return aviso('Cadastre ao menos um solicitante ativo e um tipo de problema ativo antes de abrir um chamado.', true);
  }
  abrirModal(`
    <h2>Novo chamado</h2>
    <form id="form">
      <div class="campo"><label>Solicitante</label><select name="solicitanteId">${opcoes(solicitantes.map((p) => [p.id, p.nome]))}</select></div>
      <div class="campo"><label>Tipo de problema</label><select name="tipoProblemaId">${opcoes(tipos.map((t) => [t.id, t.nome]))}</select></div>
      <div class="campo"><label>Prioridade</label><select name="prioridade">${opcoes(Object.entries(PRIORIDADES), 'media')}</select></div>
      <div class="campo"><label>Título (5 a 100 caracteres)</label><input name="titulo" maxlength="100" required></div>
      <div class="campo"><label>Descrição (mínimo 10 caracteres)</label><textarea name="descricao" required></textarea></div>
      <div class="rodape"><button type="button" id="cancelar">Cancelar</button><button class="primario">Abrir chamado</button></div>
    </form>`);
  $('#cancelar').onclick = fecharModal;
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const corpo = {
      solicitanteId: Number(f.get('solicitanteId')), tipoProblemaId: Number(f.get('tipoProblemaId')),
      prioridade: f.get('prioridade'), titulo: f.get('titulo'), descricao: f.get('descricao'),
    };
    if (await tentar(() => api('POST', '/chamados', corpo), 'Chamado aberto.')) { fecharModal(); listarChamados(); }
  };
});

async function abrirChamado(id) {
  let c;
  if (!(await tentar(async () => { c = await api('GET', `/chamados/${id}`); }))) return;
  const encerrado = c.situacao === 'fechado' || c.situacao === 'cancelado';
  const tecnicos = estado.pessoas.filter((p) => p.tipo === 'tecnico' && p.ativo && p.id !== c.solicitanteId);
  const podeDesignar = c.situacao === 'aberto' || c.situacao === 'em_atendimento';
  const autores = [c.solicitanteId, c.tecnicoId].filter(Boolean).map((i) => [i, `${pessoaNome(i)} (${i === c.solicitanteId ? 'solicitante' : 'técnico'})`]);

  abrirModal(`
    <h2>Chamado #${c.id} ${badge(c.situacao, SITUACOES[c.situacao])}</h2>
    <div class="meta">
      <div><span>Solicitante</span>${esc(pessoaNome(c.solicitanteId))}</div>
      <div><span>Técnico</span>${esc(pessoaNome(c.tecnicoId))}</div>
      <div><span>Tipo</span>${esc(tipoNome(c.tipoProblemaId))}</div>
      <div><span>Criado em</span>${data(c.criadoEm)}</div>
      <div><span>Resolvido em</span>${data(c.resolvidoEm)}</div>
    </div>

    <h3>Dados</h3>
    <form id="form-dados">
      <div class="campo"><label>Título</label><input name="titulo" value="${esc(c.titulo)}" maxlength="100" ${encerrado ? 'disabled' : ''}></div>
      <div class="campo"><label>Descrição</label><textarea name="descricao" ${encerrado ? 'disabled' : ''}>${esc(c.descricao)}</textarea></div>
      <div class="campo"><label>Prioridade</label><select name="prioridade" ${encerrado ? 'disabled' : ''}>${opcoes(Object.entries(PRIORIDADES), c.prioridade)}</select></div>
      ${encerrado ? '<p class="dica">Chamado encerrado: não pode mais ser alterado (regra 15).</p>' : '<div class="rodape"><button class="primario">Salvar alterações</button></div>'}
    </form>

    ${podeDesignar ? `
    <h3>Técnico responsável</h3>
    <div class="linha">
      <select id="sel-tecnico">${opcoes([['', '— escolha um técnico —'], ...tecnicos.map((p) => [p.id, p.nome])], c.tecnicoId)}</select>
      <button id="btn-designar" class="primario">${c.situacao === 'aberto' ? 'Designar e iniciar atendimento' : 'Trocar técnico'}</button>
    </div>` : ''}

    <h3>Situação</h3>
    <div class="linha">
      ${TRANSICOES[c.situacao].map((s) => `<button data-sit="${s}" class="${s === 'cancelado' ? 'perigo' : ''}">${c.situacao === 'resolvido' && s === 'em_atendimento' ? 'Reabrir' : { resolvido: 'Marcar como resolvido', fechado: 'Fechar chamado', cancelado: 'Cancelar chamado' }[s]}</button>`).join('')}
      ${TRANSICOES[c.situacao].length ? '' : '<span class="dica">Nenhuma mudança possível.</span>'}
      ${c.situacao === 'aberto' ? '<span class="dica">Para iniciar o atendimento, designe um técnico.</span>' : ''}
    </div>

    <h3>Comentários (${c.comentarios.length})</h3>
    ${c.comentarios.map((m) => `<div class="coment"><small>${esc(pessoaNome(m.autorId))} · ${data(m.criadoEm)}</small><p>${esc(m.texto)}</p></div>`).join('') || '<p class="dica">Sem comentários.</p>'}
    ${encerrado ? '' : `
    <form id="form-coment">
      <div class="campo"><label>Autor</label><select name="autorId">${opcoes(autores)}</select></div>
      <div class="campo"><textarea name="texto" placeholder="Escreva um comentário" required></textarea></div>
      <div class="rodape"><button class="primario">Comentar</button></div>
    </form>`}
    <div class="rodape"><button id="fechar">Fechar janela</button></div>`);

  const recarregar = async () => { await abrirChamado(id); listarChamados(); };
  $('#fechar').onclick = fecharModal;

  $('#form-dados').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const corpo = { titulo: f.get('titulo'), descricao: f.get('descricao'), prioridade: f.get('prioridade') };
    if (await tentar(() => api('PATCH', `/chamados/${id}`, corpo), 'Chamado atualizado.')) recarregar();
  };
  const bd = $('#btn-designar');
  if (bd) bd.onclick = async () => {
    const v = $('#sel-tecnico').value;
    if (!v) return aviso('Escolha um técnico.', true);
    if (await tentar(() => api('PUT', `/chamados/${id}/tecnico`, { tecnicoId: Number(v) }), 'Técnico designado.')) recarregar();
  };
  document.querySelectorAll('[data-sit]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.sit === 'cancelado' && !confirm('Cancelar este chamado? Essa ação não pode ser desfeita.')) return;
    if (b.dataset.sit === 'fechado' && !confirm('Fechar este chamado? Essa ação não pode ser desfeita.')) return;
    if (await tentar(() => api('PUT', `/chamados/${id}/situacao`, { situacao: b.dataset.sit }), 'Situação atualizada.')) recarregar();
  }));
  const fc = $('#form-coment');
  if (fc) fc.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (await tentar(() => api('POST', `/chamados/${id}/comentarios`, { autorId: Number(f.get('autorId')), texto: f.get('texto') }), 'Comentário registrado.')) recarregar();
  };
}

/* ---------- Pessoas ---------- */
function renderPessoas() {
  const corpo = $('#lista-pessoas');
  corpo.innerHTML = estado.pessoas.map((p) => `
    <tr><td>${p.id}</td><td>${esc(p.nome)}</td><td>${esc(p.email)}</td><td>${p.tipo === 'tecnico' ? 'Técnico' : 'Solicitante'}</td>
      <td>${badge(p.ativo ? 'ativo' : 'inativo', p.ativo ? 'Ativo' : 'Inativo')}</td>
      <td class="acoes">
        <button class="pequeno" data-ed="${p.id}">Editar</button>
        <button class="pequeno" data-at="${p.id}">${p.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="pequeno perigo" data-rm="${p.id}">Remover</button>
      </td></tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhuma pessoa cadastrada.</td></tr>';
  corpo.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => formPessoa(estado.pessoas.find((p) => p.id === Number(b.dataset.ed))));
  corpo.querySelectorAll('[data-at]').forEach((b) => b.onclick = async () => {
    const p = estado.pessoas.find((x) => x.id === Number(b.dataset.at));
    if (await tentar(() => api('PATCH', `/pessoas/${p.id}`, { ativo: !p.ativo }), 'Pessoa atualizada.')) renderAba('pessoas');
  });
  corpo.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    if (!confirm('Remover esta pessoa?')) return;
    if (await tentar(() => api('DELETE', `/pessoas/${b.dataset.rm}`), 'Pessoa removida.')) renderAba('pessoas');
  });
}
$('#btn-nova-pessoa').addEventListener('click', () => formPessoa());

function formPessoa(p) {
  abrirModal(`
    <h2>${p ? 'Editar pessoa' : 'Nova pessoa'}</h2>
    <form id="form">
      <div class="campo"><label>Nome</label><input name="nome" value="${esc(p?.nome)}" required></div>
      <div class="campo"><label>E-mail</label><input name="email" type="email" value="${esc(p?.email)}" required></div>
      <div class="campo"><label>Tipo</label><select name="tipo">${opcoes([['solicitante', 'Solicitante'], ['tecnico', 'Técnico']], p?.tipo)}</select></div>
      <div class="rodape"><button type="button" id="cancelar">Cancelar</button><button class="primario">Salvar</button></div>
    </form>`);
  $('#cancelar').onclick = fecharModal;
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const ok = await tentar(() => (p ? api('PATCH', `/pessoas/${p.id}`, f) : api('POST', '/pessoas', f)), 'Pessoa salva.');
    if (ok) { fecharModal(); renderAba('pessoas'); }
  };
}

/* ---------- Tipos de problema ---------- */
function renderTipos() {
  const corpo = $('#lista-tipos');
  corpo.innerHTML = estado.tipos.map((t) => `
    <tr><td>${t.id}</td><td>${esc(t.nome)}</td><td>${badge(t.ativo ? 'ativo' : 'inativo', t.ativo ? 'Ativo' : 'Inativo')}</td>
      <td class="acoes">
        <button class="pequeno" data-ed="${t.id}">Editar</button>
        <button class="pequeno" data-at="${t.id}">${t.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="pequeno perigo" data-rm="${t.id}">Remover</button>
      </td></tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhum tipo cadastrado.</td></tr>';
  corpo.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => formTipo(estado.tipos.find((t) => t.id === Number(b.dataset.ed))));
  corpo.querySelectorAll('[data-at]').forEach((b) => b.onclick = async () => {
    const t = estado.tipos.find((x) => x.id === Number(b.dataset.at));
    if (await tentar(() => api('PATCH', `/tipos-problema/${t.id}`, { ativo: !t.ativo }), 'Tipo atualizado.')) renderAba('tipos');
  });
  corpo.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    if (!confirm('Remover este tipo?')) return;
    if (await tentar(() => api('DELETE', `/tipos-problema/${b.dataset.rm}`), 'Tipo removido.')) renderAba('tipos');
  });
}
$('#btn-novo-tipo').addEventListener('click', () => formTipo());

function formTipo(t) {
  abrirModal(`
    <h2>${t ? 'Editar tipo de problema' : 'Novo tipo de problema'}</h2>
    <form id="form">
      <div class="campo"><label>Nome</label><input name="nome" value="${esc(t?.nome)}" maxlength="100" required></div>
      <div class="rodape"><button type="button" id="cancelar">Cancelar</button><button class="primario">Salvar</button></div>
    </form>`);
  $('#cancelar').onclick = fecharModal;
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const ok = await tentar(() => (t ? api('PATCH', `/tipos-problema/${t.id}`, f) : api('POST', '/tipos-problema', f)), 'Tipo salvo.');
    if (ok) { fecharModal(); renderAba('tipos'); }
  };
}

renderAba('chamados');
