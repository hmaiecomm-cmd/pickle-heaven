/** 後台品牌圖形：匹克球拍標誌、森林剪影、底部山丘 */

export function PaddleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <g transform="rotate(-40 20 20)">
        <rect x="17.5" y="22" width="5" height="13" rx="2" fill="#d9f99d" />
        <ellipse cx="20" cy="14" rx="9" ry="11" fill="none" stroke="#ecfccb" strokeWidth="2.6" />
      </g>
      <circle cx="29" cy="11" r="6" fill="#facc15" />
      {[
        [27, 9],
        [31, 9.5],
        [29, 12.5],
        [26.5, 13],
        [31.5, 13],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#a16207" />
      ))}
    </svg>
  )
}

export function ForestSilhouette({ className }: { className?: string }) {
  const trees = [
    [20, 34, 0.55],
    [34, 28, 0.75],
    [48, 32, 0.6],
    [62, 22, 0.9],
    [76, 30, 0.7],
    [90, 24, 0.85],
    [104, 33, 0.6],
    [118, 26, 0.8],
    [132, 31, 0.65],
    [146, 23, 0.9],
    [160, 32, 0.6],
    [174, 27, 0.75],
  ]
  return (
    <svg viewBox="0 0 190 60" preserveAspectRatio="xMaxYMax meet" className={className} aria-hidden>
      <path d="M0 60 C 40 40, 80 44, 110 38 S 170 36, 190 42 L 190 60 Z" fill="#dcefd0" />
      {trees.map(([x, top, o]) => (
        <path key={x} d={`M${x} ${top} L${x - 6} 56 L${x + 6} 56 Z`} fill="#5e9e57" opacity={o} />
      ))}
      <path d="M0 60 C 50 50, 100 54, 140 50 S 180 50, 190 52 L 190 60 Z" fill="#cfe6c0" />
    </svg>
  )
}

export function Hills({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 60" preserveAspectRatio="none" className={className} aria-hidden>
      <path d="M0 40 C 80 10, 160 20, 230 32 S 360 18, 400 26 L 400 60 L 0 60 Z" fill="#e3f0d8" />
      <path d="M0 50 C 100 30, 200 44, 280 40 S 380 36, 400 42 L 400 60 L 0 60 Z" fill="#d3e7c3" />
    </svg>
  )
}
