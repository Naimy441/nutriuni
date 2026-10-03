// Dawn (Fajr) and sunset (Maghrib) for Durham, for planning suhoor and iftar.
// Standard solar formulas (as used by praytimes.org); Fajr uses the ISNA
// convention of the sun 15° below the horizon. Computed on the phone, so it
// works offline. Times are local clock minutes after midnight.
import { dateFromKey } from './dates';

const DURHAM = { latitude: 36.0014, longitude: -78.9382 };
export const FAJR_ANGLE = 15;
const SUNSET_ANGLE = 0.833; // refraction + the sun's radius

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const fix = (value: number, range: number) => ((value % range) + range) % range;

function julianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

// Sun declination (degrees) and equation of time (hours).
function sunPosition(jd: number): { declination: number; equation: number } {
  const d = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * d, 360);
  const q = fix(280.459 + 0.98564736 * d, 360);
  const l = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * d;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(l)), Math.cos(rad(l)))) / 15, 24);
  return {
    declination: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(l)))),
    equation: q / 15 - ra,
  };
}

export interface FastingTimes {
  fajr: number; // minutes after local midnight
  maghrib: number;
}

export function fastingTimes(date: string, place = DURHAM): FastingTimes {
  const day = dateFromKey(date);
  // Hours east of UTC on that date, so daylight saving is handled.
  const zone = -new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTimezoneOffset() / 60;
  const jd = julianDay(day.getFullYear(), day.getMonth() + 1, day.getDate()) - place.longitude / 360;
  const { declination, equation } = sunPosition(jd + 0.5);
  const noon = fix(12 - equation, 24) + zone - place.longitude / 15;
  const hourAngle = (angle: number) => {
    const cos = (-Math.sin(rad(angle)) - Math.sin(rad(place.latitude)) * Math.sin(rad(declination)))
      / (Math.cos(rad(place.latitude)) * Math.cos(rad(declination)));
    return deg(Math.acos(Math.min(1, Math.max(-1, cos)))) / 15;
  };
  return {
    fajr: Math.round((noon - hourAngle(FAJR_ANGLE)) * 60),
    maghrib: Math.round((noon + hourAngle(SUNSET_ANGLE)) * 60),
  };
}

export function clockLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const suffix = hours >= 12 ? 'pm' : 'am';
  return `${hours % 12 || 12}:${String(mins).padStart(2, '0')} ${suffix}`;
}
