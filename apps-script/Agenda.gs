/**
 * Rotina clínica · ponte entre o Calendário do site e o Google Agenda.
 *
 * Usa só a agenda chamada "Rotina clínica" (cria se não existir).
 * O site lê e grava eventos por aqui; o que você muda no Google Agenda aparece no site, e o contrário também.
 *
 * Como publicar (uma vez):
 *   1. script.google.com → Novo projeto → apague o conteúdo e cole este arquivo inteiro.
 *   2. Na barra de cima, escolha a função "configurar" e clique em Executar. Autorize o acesso à agenda.
 *   3. Implantar → Nova implantação → tipo "App da Web".
 *      Executar como: Eu.   Quem pode acessar: Qualquer pessoa.
 *   4. Copie o endereço que termina em /exec e mande para o Claude.
 *
 * Segurança: o site só é atendido se mandar o TOKEN abaixo, que fica dentro da parte cifrada do site.
 * Se trocar o TOKEN aqui, ele precisa ser trocado no site também.
 */
const TOKEN = '__TOKEN__';
const NOME_AGENDA = 'Rotina clínica';

/* tipo do site ↔ cor do Google Agenda */
const COR_DO_TIPO = { prova: '11', plantao: '6', amb: '3', aula: '9', entrega: '7', pessoal: '8' };
const TIPO_DA_COR = { '11': 'prova', '4': 'prova', '6': 'plantao', '5': 'plantao', '3': 'amb', '1': 'amb',
                      '9': 'aula', '7': 'entrega', '2': 'entrega', '10': 'entrega', '8': 'pessoal' };

/* Rode uma vez pelo editor: cria a agenda (se faltar) e pede as autorizações. */
function configurar() {
  const cal = agenda_();
  Logger.log('Pronto. Agenda "%s" (%s), fuso %s.', cal.getName(), cal.getId(), cal.getTimeZone());
}

function doGet() {
  return json_({ ok: true, app: 'rotina-clinica-agenda' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, erro: 'pedido inválido' }); }
  if (req.token !== TOKEN) return json_({ ok: false, erro: 'não autorizado' });

  try {
    const cal = agenda_();
    if (req.acao === 'listar') return json_({ ok: true, eventos: listar_(cal, req.de, req.ate), fuso: cal.getTimeZone() });

    const trava = LockService.getScriptLock();
    trava.waitLock(20000);
    try {
      if (req.acao === 'salvar') return json_({ ok: true, evento: salvar_(cal, req.evento) });
      if (req.acao === 'excluir') { excluir_(cal, req.id); return json_({ ok: true }); }
      if (req.acao === 'lote') {
        /* várias operações de uma vez (fila de quando o aparelho estava sem internet, ou a primeira sincronização) */
        const res = (req.ops || []).map(function (op) {
          try {
            if (op.op === 'salvar') return { ok: true, ref: op.ref, evento: salvar_(cal, op.evento) };
            if (op.op === 'excluir') { excluir_(cal, op.id); return { ok: true, ref: op.ref }; }
            return { ok: false, ref: op.ref, erro: 'operação desconhecida' };
          } catch (err) { return { ok: false, ref: op.ref, erro: String(err.message || err) }; }
        });
        return json_({ ok: true, resultados: res });
      }
    } finally { trava.releaseLock(); }
    return json_({ ok: false, erro: 'ação desconhecida' });
  } catch (err) {
    return json_({ ok: false, erro: String(err.message || err) });
  }
}

/* ---------- agenda ---------- */
function agenda_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('AGENDA_ID');
  let cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    const achadas = CalendarApp.getCalendarsByName(NOME_AGENDA);
    cal = achadas.length ? achadas[0] : CalendarApp.createCalendar(NOME_AGENDA, { color: CalendarApp.Color.RED });
    props.setProperty('AGENDA_ID', cal.getId());
  }
  return cal;
}

function listar_(cal, de, ate) {
  const tz = cal.getTimeZone();
  const ini = Utilities.parseDate(de + ' 00:00', tz, 'yyyy-MM-dd HH:mm');
  const fim = Utilities.parseDate(ate + ' 23:59', tz, 'yyyy-MM-dd HH:mm');
  return cal.getEvents(ini, fim).map(function (ev) { return paraSite_(ev, tz); });
}

function paraSite_(ev, tz) {
  const dia = ev.isAllDayEvent();
  const ini = dia ? ev.getAllDayStartDate() : ev.getStartTime();
  const d = Utilities.formatDate(ini, tz, 'yyyy-MM-dd');
  const o = {
    id: ev.getId(),
    t: ev.getTitle() || '(sem título)',
    d: d,
    h: dia ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
    hf: dia ? '' : Utilities.formatDate(ev.getEndTime(), tz, 'HH:mm'),
    tipo: ev.getTag('rc_tipo') || TIPO_DA_COR[ev.getColor()] || 'pessoal',
    obs: textoPuro_(ev.getDescription()),
    imp: ev.getTag('rc_imp') === '1'
  };
  if (dia) {
    /* evento de dia inteiro com mais de um dia: o fim do Google é exclusivo */
    const ult = new Date(ev.getAllDayEndDate().getTime() - 12 * 3600 * 1000);
    const ate = Utilities.formatDate(ult, tz, 'yyyy-MM-dd');
    if (ate > d) o.ate = ate;
  }
  if (ev.isRecurringEvent()) { o.rec = true; o.id = ev.getId() + '|' + d; }
  return o;
}

function salvar_(cal, s) {
  if (!s || !s.t || !/^\d{4}-\d{2}-\d{2}$/.test(s.d || '')) throw new Error('evento incompleto');
  const tz = cal.getTimeZone();
  const temHora = /^\d{2}:\d{2}$/.test(s.h || '');
  let ev = s.id && String(s.id).indexOf('@') > 0 && String(s.id).indexOf('|') < 0 ? cal.getEventById(s.id) : null;
  if (ev && ev.isRecurringEvent()) throw new Error('evento recorrente: edite no Google Agenda');

  if (temHora) {
    const ini = Utilities.parseDate(s.d + ' ' + s.h, tz, 'yyyy-MM-dd HH:mm');
    let dur = 60 * 60 * 1000;
    if (ev && !ev.isAllDayEvent()) dur = ev.getEndTime().getTime() - ev.getStartTime().getTime();
    const fim = new Date(ini.getTime() + dur);
    if (ev) ev.setTime(ini, fim); else ev = cal.createEvent(s.t, ini, fim);
  } else {
    const dia = Utilities.parseDate(s.d + ' 12:00', tz, 'yyyy-MM-dd HH:mm');
    if (ev) ev.setAllDayDate(dia); else ev = cal.createAllDayEvent(s.t, dia);
  }
  ev.setTitle(String(s.t).slice(0, 300));
  ev.setDescription(String(s.obs || '').slice(0, 4000));
  const tipo = COR_DO_TIPO[s.tipo] ? s.tipo : 'pessoal';
  ev.setTag('rc_tipo', tipo);
  ev.setTag('rc_imp', s.imp ? '1' : '0');
  ev.setColor(COR_DO_TIPO[tipo]);
  return paraSite_(ev, tz);
}

function excluir_(cal, id) {
  if (!id || String(id).indexOf('|') >= 0) throw new Error('evento recorrente: exclua no Google Agenda');
  const ev = cal.getEventById(id);
  if (ev) ev.deleteEvent();
}

/* ---------- utilidades ---------- */
function textoPuro_(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
