// Device detection. ?touch=1 / ?touch=0 forces touch controls on / off, ?low=1 / ?low=0 forces the light graphics mode.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const hasWin = typeof window !== 'undefined'
export const isTouch = q.get('touch') === '1' ? true : q.get('touch') === '0' ? false : hasWin && ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0)
// LOW = lighter graphics for phones / weak laptops: smaller render resolution, smaller shadow map, fewer cars / people / raindrops, no MSAA
export const LOW = q.get('low') === '1' ? true : q.get('low') === '0' ? false : isTouch || (hasWin && (navigator.hardwareConcurrency || 8) <= 4)
if (hasWin && isTouch) document.documentElement.classList.add('touch')
