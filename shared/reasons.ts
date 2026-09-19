// Human-readable text for the engine's structured reasons. The engine itself never produces prose.
import type { ConflictCode, ReasonCode } from './domain'

export const REASON_TEXT: Record<ReasonCode, string> = {
  HIGH_PRIORITY: 'Tem prioridade alta.',
  PREFERRED_TIME: 'Cai dentro do teu horário preferido.',
  PREFERRED_DAY: 'É num dos teus dias preferidos.',
  BEFORE_DEADLINE: 'Fica antes do prazo, com margem.',
  SPREAD_OUT: 'Distribui as sessões pela semana.',
  LIGHT_DAY: 'É um dia com pouca carga.',
  SHORTENED: 'Foi encurtada porque não havia um intervalo maior.',
}

export const CONFLICT_TEXT: Record<ConflictCode, string> = {
  INSUFFICIENT_AVAILABLE_TIME: 'Não há tempo livre suficiente',
  DEADLINE_UNACHIEVABLE: 'O prazo não permite encaixar tudo',
}
