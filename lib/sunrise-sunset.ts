/**
 * Calculate theme based on sunrise/sunset times.
 * Uses a simplified solar equation with a fixed latitude of 35°N (central China).
 * Pure math — no API calls or geolocation.
 */
export function getSunriseSunsetTheme(): "light" | "dark" {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const dayOfYear =
    Math.floor((now.getTime() - start.getTime()) / 86400000) + 1

  // Solar declination (simplified)
  const declination = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365)

  const latRad = (35 * Math.PI) / 180
  const declRad = (declination * Math.PI) / 180

  // Hour angle for sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad)
  const hourAngle =
    Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * (180 / Math.PI)

  // Convert to hours offset from solar noon (12:00)
  const offset = hourAngle / 15
  const sunrise = 12 - offset
  const sunset = 12 + offset

  const currentHour = now.getHours() + now.getMinutes() / 60
  return currentHour >= sunrise && currentHour < sunset ? "light" : "dark"
}
