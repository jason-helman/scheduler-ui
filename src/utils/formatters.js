export function formatTime12h(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hours = Number.parseInt(h, 10)
    if (!Number.isFinite(hours) || !m) return String(timeStr)
    const suffix = hours >= 12 ? 'pm' : 'am'
    const displayHours = ((hours + 11) % 12 + 1).toString().padStart(2, '0')
    return `${displayHours}:${m}${suffix}`
}
