import { countdownDate } from '../config/event';

export function remainingSeconds(now = Date.now()) {
  return Math.max(0, Math.ceil((countdownDate().getTime() - now) / 1000));
}

export function countdownValues(seconds: number, hoursOnly = false) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const rest = total % 60;
  return hoursOnly ? [hours, minutes, rest] : [Math.floor(hours / 24), hours % 24, minutes, rest];
}
