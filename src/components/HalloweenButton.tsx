interface HalloweenButtonProps {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
  secondary?: boolean;
}

export default function HalloweenButton({ href, children, compact, secondary }: HalloweenButtonProps) {
  return <a className={`night-button${compact ? ' night-button--compact' : ''}${secondary ? ' night-button--secondary' : ''}`} href={href} target="_blank" rel="noreferrer">
    {!secondary && <img className="night-button__wing" src={`${import.meta.env.BASE_URL}images/identity/night-wing.svg`} alt="" aria-hidden="true"/>}
    <span>{children}</span><span className="night-button__arrow" aria-hidden="true">↗</span>
  </a>;
}
