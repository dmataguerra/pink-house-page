import Countdown from '../components/Countdown';
import './AfterDarkFooter.css';

type AfterDarkFooterProps = {
  onConfirm: () => void;
};

export default function AfterDarkFooter({ onConfirm }: AfterDarkFooterProps) {
  return <footer className="after-dark-footer ph-footer" id="footer">
    <a className="ph-footer-brand" href="#top" aria-label="The Pink House, volver al inicio">
      <img src={`${import.meta.env.BASE_URL}images/pink-house-after-dark-mark.svg`} alt="" width="214" height="144" />
    </a>
    <div className="ph-footer-next">
      <p className="ph-footer-heading"><span>PRÓXIMO</span>{' '}<span>EVENTO</span></p>
      <button className="ph-footer-event" onClick={onConfirm} type="button" aria-label="Halloween, confirmar asistencia" aria-haspopup="dialog" aria-controls="attendance-modal">HALLOWEEN</button>
      <div className="ph-footer-countdown"><Countdown /></div>
    </div>
  </footer>;
}
