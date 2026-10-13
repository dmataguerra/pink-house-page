import { nightSchedule } from '../data/nightSchedule';
import { event } from '../config/event';
import './NightSchedule.css';

function displayTime(time: string) {
  const [hours, minutes] = time.split(':');
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes}${hour >= 12 ? 'pm' : 'am'}`;
}

function activityDateTime(time: string, dayOffset = 0) {
  const date = new Date(`${event.eventDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return `${date.toISOString().slice(0, 10)}T${time}:00${event.utcOffset}`;
}

export default function NightSchedule() {
  return <div className="night-schedule">
    <p className="schedule-eyebrow">22.10.26 · INICIO 8:00PM</p>
    <ol className="schedule-list" aria-label="Cronograma de actividades">
      {nightSchedule.map(activity => <li className="schedule-item" key={activity.title}>
        {activity.time === null
          ? <span className="schedule-preparty">PREPARTY</span>
          : <time dateTime={activityDateTime(activity.time, activity.dayOffset)}>{displayTime(activity.time)}</time>}
        <div className="schedule-activity">
          <h3>{activity.title}</h3>
          {activity.description && <p className="schedule-description">{activity.description}</p>}
        </div>
      </li>)}
    </ol>
  </div>;
}
