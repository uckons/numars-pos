/**
 * Format seconds into time display
 * @param {number} seconds - Total seconds remaining
 * @returns {string} Formatted time string (HH:MM:SS or MM:SS)
 */
export function formatTime(seconds) {
  if (seconds == null) return "--"
  
  const totalMinutes = Math.floor(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const s = seconds % 60
  
  if (h > 0) {
    // Format as HH:MM:SS when >= 1 hour
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  } else {
    // Format as MM:SS when < 1 hour
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}
