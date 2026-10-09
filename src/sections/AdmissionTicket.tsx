import MummyTicket from '../components/MummyTicket';
import './AdmissionTicket.css';

type AdmissionTicketProps = {
  onConfirm: () => void;
  onSchedule: () => void;
};

export default function AdmissionTicket({ onConfirm, onSchedule }: AdmissionTicketProps) {
  return <section className="admission-ticket-section" aria-label="Ticket de entrada">
    <MummyTicket onConfirm={onConfirm} onWin={onSchedule}/>
  </section>;
}
