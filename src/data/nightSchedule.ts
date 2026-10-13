export interface NightActivity {
  time: string | null;
  title: string;
  description?: string;
  dayOffset?: number;
}

export const nightSchedule: NightActivity[] = [
  { time: null, title: 'Película preparty', description: 'La venganza del charro negro' },
  { time: '20:00', title: 'Inicio' },
  { time: '20:10', title: 'Dinámicas' },
  { time: '21:00', title: 'Piñata' },
  { time: '21:20', title: 'Concurso de disfraz' },
  { time: '21:40', title: 'Foto grupal' },
  { time: '22:30', title: 'Beer pong' },
  { time: '23:30', title: 'Batalla de Tilín insano' },
  { time: '00:00', title: 'Perreo intenso', dayOffset: 1 },
];
