import { useEffect, useState } from 'react'
import { PROFILE } from './data'
import { useGame } from './store'
import { isTouch } from './device'

// Opening title card: black -> logo fades in over the orbiting sunset scene -> "PRESS ENTER".
// (Original artwork in the style of retro neon game logos: giant gradient letters + chunky white title.)
export function Intro() {
  const start = useGame((s) => s.start)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const go = (e) => {
      if (e.type === 'keydown' && ['Tab', 'F5', 'F12', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'AltLeft', 'MetaLeft'].includes(e.code)) return
      setLeaving(true); setTimeout(start, 650)
      window.removeEventListener('keydown', go); window.removeEventListener('pointerdown', go)
    }
    const t = setTimeout(() => { window.addEventListener('keydown', go); window.addEventListener('pointerdown', go) }, 1800)
    return () => { clearTimeout(t); window.removeEventListener('keydown', go); window.removeEventListener('pointerdown', go) }
  }, [start])
  const [a, b, c] = PROFILE.gameTitle
  return (
    <div className={'intro' + (leaving ? ' out' : '')}>
      <div className="introwrap">
        <div className="welcome">{PROFILE.welcome}</div>
        <svg viewBox="0 0 860 484" className="logo" aria-label={PROFILE.gameTitle.join(' ')}>
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4f7bff" /><stop offset="0.38" stopColor="#b44fd8" /><stop offset="0.7" stopColor="#ff5d8f" /><stop offset="1" stopColor="#ffb347" />
            </linearGradient>
            <clipPath id="lc"><text x="430" y="440" textAnchor="middle" fontSize="520" textLength="780" lengthAdjust="spacingAndGlyphs">{PROFILE.initials}</text></clipPath>
          </defs>
          <text x="430" y="440" textAnchor="middle" fontSize="520" textLength="780" lengthAdjust="spacingAndGlyphs" fill="url(#lg)" stroke="#3d1466" strokeWidth="26" strokeLinejoin="round" paintOrder="stroke">{PROFILE.initials}</text>
          <text x="430" y="440" textAnchor="middle" fontSize="520" textLength="780" lengthAdjust="spacingAndGlyphs" fill="url(#lg)">{PROFILE.initials}</text>
          <g clipPath="url(#lc)" stroke="rgba(60,5,110,.45)" strokeWidth="9" strokeLinecap="round" fill="none">
            {[[250, 470, 1.25], [610, 480, 1.5]].map(([x, y, s], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                <path d="M0 0 C 8 -70, 2 -140, 16 -205" />
                {[[-90, -150], [-70, -205], [-20, -240], [60, -235], [105, -190], [95, -145]].map(([dx, dy], k) => <path key={k} d={`M16 -205 Q ${16 + dx * 0.4} ${-205 + dy * 0.55 - 40} ${16 + dx} ${-205 + (dy + 205) * 0.7}`} />)}
              </g>
            ))}
          </g>
          {[[a, 212, 140, 440], [b, 330, 140, 420], [c, 440, 112, 600]].map(([t, y, fs, w], i) => (
            <g key={i} className="tl" fontSize={fs}>
              <text x="430" y={y} textAnchor="middle" textLength={w} lengthAdjust="spacingAndGlyphs" fill="#fff" stroke="#241044" strokeWidth="24" strokeLinejoin="round" paintOrder="stroke">{t}</text>
              <text x="430" y={y} textAnchor="middle" textLength={w} lengthAdjust="spacingAndGlyphs" fill="#fff">{t}</text>
            </g>
          ))}
        </svg>
        <div className="press">{isTouch ? 'TAP ANYWHERE TO START' : 'PRESS ANY KEY TO START'}</div>
        <div className="introkeys">W A S D drive · F get in / out · E read a chapter · SHIFT run · SPACE brake / jump · TAB cheat codes</div>
      </div>
    </div>
  )
}
