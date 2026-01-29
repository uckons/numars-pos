/**
 * Format seconds into HH:MM:SS or MM:SS format
 * @param {number} seconds - The number of seconds to format
 * @returns {string} Formatted time string
 */
export function formatSecondsToTime(seconds) {
  if (seconds == null || seconds < 0) return "--"
  
  const totalMinutes = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  
  // Format as HH:MM:SS if >= 1 hour, otherwise MM:SS
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  } else {
    return `${m}:${String(s).padStart(2, '0')}`
  }
}
