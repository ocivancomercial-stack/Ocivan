'use strict';

// Datas no fuso horário do negócio (padrão America/Sao_Paulo), e não em UTC.
// Ex.: às 22h de 27/11 em Brasília já é 28/11 em UTC; a proposta e a renovação usam 27/11.

function partesNoFuso(fuso, agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora).map(x => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute) };
}

const hojeNoFuso = (fuso, agora) => partesNoFuso(fuso, agora).data;

function fusoValido(fuso) {
  try { new Intl.DateTimeFormat('en', { timeZone: fuso }); return true; } catch { return false; }
}

module.exports = { partesNoFuso, hojeNoFuso, fusoValido };
