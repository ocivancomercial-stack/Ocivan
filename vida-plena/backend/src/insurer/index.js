'use strict';

// Escolhe a implementação da seguradora. As duas têm a mesma interface:
//   cotar(entrada)            -> { idCotacao, idade, itens[], premioLiquido, iof, premioMensal, premioAnual, validaAte, comissaoMaxima }
//   emitirProposta(proposta)  -> { numeroProposta, status }
//   consultarProposta(numero) -> { numeroProposta, status, numeroApolice? }
//   renovar({ numeroProposta, novaVigenciaInicio, novaVigenciaFim }) -> { status: 'RENOVADA'|'NAO_RENOVADA', motivo? }
module.exports = function createInsurer(config) {
  if (config.insurer === 'tokio') return require('./tokioMarine.http')(config);
  return require('./tokioMarine.mock')(config);
};
