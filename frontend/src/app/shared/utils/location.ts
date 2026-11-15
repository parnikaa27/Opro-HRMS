// Where the browser says this device is. Only asked for when someone punches from the office.
export interface Location {
  latitude: number;
  longitude: number;
  // The browser's own estimate, in metres.
  accuracy: number;
}

const WAIT_MS = 15_000;

// Each failure says what to do next. GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timed out.
const PERMISSION_DENIED = 1;
const LOCATION_BLOCKED = 'Location is blocked for the portal. Allow it in your browser settings and try again.';
const LOCATION_UNKNOWN = "We couldn't find where you are. Check location is on, step near a window and try again.";

// A failure the person can act on. Its message is written for them.
export class LocationError extends Error {}

export const currentLocation = () =>
  new Promise<Location>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError(LOCATION_UNKNOWN));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      ({ code }) => reject(new LocationError(code === PERMISSION_DENIED ? LOCATION_BLOCKED : LOCATION_UNKNOWN)),
      { enableHighAccuracy: true, timeout: WAIT_MS, maximumAge: 0 },
    );
  });
