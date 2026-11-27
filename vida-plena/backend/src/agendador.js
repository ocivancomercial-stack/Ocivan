'use strict';

// Agendador de tarefas diárias (hoje: a renovação automática das apólices).
//
// - Confere a cada minuto. A partir da hora configurada (no fuso do negócio), roda a tarefa
//   uma vez por dia. Se o servidor estava desligado nesse horário, roda assim que voltar.
// - Com vários servidores no ar, só um executa cada dia: antes de rodar, ele "reserva" o dia
//   na tabela agendamentos (chave tarefa + data). Quem não conseguir reservar não roda.
// - Se a execução falhar, fica registrada como ERRO e é tentada de novo depois de
//   `esperaAposErroMin` minutos. Se um servidor cair no meio, a reserva vence depois de
//   `limiteExecucaoMin` minutos e outro servidor assume.
// - O histórico fica na tabela agendamentos (rota GET /api/admin/agendamentos).

const { partesNoFuso } = require('./services/datas');

function criarAgendador({ db, tarefa, hora, fusoHorario, executar, agora = () => new Date(),
  esperaAposErroMin = 15, limiteExecucaoMin = 60, intervaloMs = 60_000, log = console }) {
  let timer = null, conferindo = null;

  const iso = d => d.toISOString();
  const minutosAtras = min => iso(new Date(agora().getTime() - min * 60_000));

  // Tenta reservar o dia. Devolve true só para o servidor que conseguiu.
  async function reservar(data) {
    const inicio = iso(agora());
    const novo = await db.run(`INSERT INTO agendamentos (tarefa, data_referencia, status, iniciado_em) VALUES (?,?,'EXECUTANDO',?)
      ON CONFLICT (tarefa, data_referencia) DO NOTHING`, tarefa, data, inicio);
    if (novo.changes) return true;
    // Já existe: só reassume se falhou há algum tempo ou se ficou travada (servidor caiu no meio).
    const retomada = await db.run(`UPDATE agendamentos SET status='EXECUTANDO', iniciado_em=?, concluido_em=NULL
      WHERE tarefa=? AND data_referencia=? AND ((status='ERRO' AND concluido_em<?) OR (status='EXECUTANDO' AND iniciado_em<?))`,
      inicio, tarefa, data, minutosAtras(esperaAposErroMin), minutosAtras(limiteExecucaoMin));
    return retomada.changes > 0;
  }

  async function registrar(data, status, resultado) {
    await db.run(`UPDATE agendamentos SET status=?, concluido_em=?, resultado_json=? WHERE tarefa=? AND data_referencia=?`,
      status, iso(agora()), JSON.stringify(resultado), tarefa, data);
  }

  // Confere se está na hora e, se estiver, executa. Devolve o que aconteceu (útil nos testes).
  async function conferir() {
    const { data, hora: horaAgora } = partesNoFuso(fusoHorario, agora());
    if (horaAgora < hora) return { executou: false, motivo: 'antes do horário', data };
    if (!(await reservar(data))) return { executou: false, motivo: 'já executada ou em execução', data };
    try {
      const resultado = await executar(data);
      await registrar(data, 'CONCLUIDA', resultado);
      log.info?.(`Agendador: ${tarefa} de ${data} concluída`, resumo(resultado));
      return { executou: true, data, resultado };
    } catch (e) {
      await registrar(data, 'ERRO', { erro: e.message }).catch(() => {});
      log.error?.(`Agendador: ${tarefa} de ${data} falhou: ${e.message}`);
      return { executou: true, data, erro: e.message };
    }
  }

  // Evita duas conferências ao mesmo tempo no mesmo servidor.
  function conferirUmaVez() {
    if (!conferindo) conferindo = conferir().catch(e => log.error?.(`Agendador: ${e.message}`)).finally(() => { conferindo = null; });
    return conferindo;
  }

  return {
    conferir: conferirUmaVez,
    iniciar() {
      if (timer) return;
      conferirUmaVez();
      timer = setInterval(conferirUmaVez, intervaloMs);
      timer.unref();
    },
    async parar() {
      clearInterval(timer); timer = null;
      await conferindo;
    },
  };
}

function resumo(r) {
  if (!r || !Array.isArray(r.resultado)) return '';
  const cont = {};
  for (const x of r.resultado) cont[x.status] = (cont[x.status] || 0) + 1;
  return JSON.stringify(cont);
}

module.exports = { criarAgendador };
