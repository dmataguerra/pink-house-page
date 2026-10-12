const source = `${import.meta.env.BASE_URL}videos/acercamiento-orbital.mp4?v=orbital-20261008`;

export default function AfterDarkLocation() {
  return <section className="ad-location" id="location" aria-label="Mapa 3D de Juriquilla, Querétaro">
    <video className="ad-map-video" src={source} autoPlay muted playsInline loop preload="auto" aria-label="Recorrido 3D de Juriquilla con The Pink House, UAQ, UVM y ENES"/>
  </section>;
}
