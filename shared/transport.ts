// Transport modes and grounded ideas for using commute time. The assistant gets these through a tool, so its
// advice comes from here rather than being invented.
import type { TransportMode } from './domain'

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  walk: 'A pé',
  bike: 'Bicicleta',
  bus: 'Autocarro',
  train: 'Metro / comboio',
  car: 'Carro',
}

export const TRANSPORT_TIPS: Record<TransportMode, string[]> = {
  walk: [
    'Ouve um podcast ou um audiolivro enquanto caminhas.',
    'Usa o percurso para revisão em áudio (matéria gravada, línguas).',
    'Se o caminho for curto, aproveita-o como pausa ativa entre blocos de estudo.',
  ],
  bike: [
    'Mãos e olhos ocupados: só música ou áudio de fundo com um só auricular, com segurança.',
    'Trata o percurso como treino leve e conta-o como movimento do dia.',
  ],
  bus: [
    'Lê ou estuda cartões de revisão (flashcards) no telemóvel.',
    'Responde a emails e organiza o dia antes de chegares.',
    'Ouve um podcast ou audiolivro, ou avança num curso online.',
  ],
  train: [
    'Tempo bom para leitura mais longa ou para estudar com o portátil.',
    'Faz exercícios ou revê apontamentos em blocos de 20–30 minutos.',
    'Planeia a semana ou escreve o diário de estudo.',
  ],
  car: [
    'Só áudio, sem ecrãs: podcasts, audiolivros ou aulas gravadas.',
    'Usa mãos livres para ligar a quem não tens tempo de ligar durante o dia.',
    'Revê mentalmente o dia ou a matéria em voz alta.',
  ],
}
