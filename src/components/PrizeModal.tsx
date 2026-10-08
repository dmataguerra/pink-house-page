import SiteModal from './SiteModal';
import NightSchedule from '../sections/NightSchedule';

export default function PrizeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <SiteModal id="prize-modal" title="EL PLAN DE LA NOCHE" open={open} onClose={onClose} className="schedule-modal">
    <NightSchedule/>
  </SiteModal>;
}
