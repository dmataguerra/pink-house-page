export const event = {
  eventName: 'Halloween en The Pink House',
  eventDate: '2026-10-22',
  // Replace null with HH:mm when confirmed. Midnight is the countdown placeholder.
  eventTime: null as string | null,
  utcOffset: '-06:00',
  instagramUsername: 'david_mata_g',
  attendanceUrl: 'https://calendar.app.google/HCNWJHqhFCBNuWdn9',
  locationLabel: 'Compartida al confirmar',
  // Set to '/assets/house/house-master.webp' when the prepared photo is ready.
  houseAsset: null as string | null,
};
export const countdownDate = () => new Date(`${event.eventDate}T${event.eventTime ?? '00:00'}:00${event.utcOffset}`);

