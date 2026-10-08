import { nightSchedule } from '../data/nightSchedule';
import { event } from '../config/event';
import './NightSchedule.css';

export default function NightSchedule() {
  return <div className="night-schedule">
    <p className="schedule-eyebrow">22.10.26 · DESDE LAS 20:00</p>
    <ol className="schedule-list" aria-label="Cronograma de actividades">
      {nightSchedule.map(activity => <li className="schedule-item" key={activity.time}>
        <time dateTime={`${event.eventDate}T${activity.time}:00${event.utcOffset}`}>{activity.time}</time>
        <h3>{activity.title}</h3>
      </li>)}
    </ol>
    <p className="schedule-note">Los horarios después de las 20:00 son sugeridos.</p>
  </div>;
}
