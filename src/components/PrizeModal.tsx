import SiteModal from './SiteModal';
import './MummyTicket.css';

export default function PrizeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <SiteModal id="prize-modal" title="¡Sorpresa desbloqueada!" open={open} onClose={onClose} className="prize-modal">
    <div className="prize-mark" aria-hidden="true">
      <svg viewBox="0 0 160 120" fill="none">
        <path d="M80 8v12M26 30l8 8m92-8-8 8M20 76h12m108 0h-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="46" y="58" width="68" height="44" rx="5" stroke="currentColor" strokeWidth="2.5"/>
        <rect x="40" y="44" width="80" height="16" rx="4" fill="#ff4f91"/>
        <path d="M80 44v58M80 44c-26 0-31-25-17-25 12 0 17 25 17 25Zm0 0c26 0 31-25 17-25-12 0-17 25-17 25Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      </svg>
    </div>
  </SiteModal>;
}
