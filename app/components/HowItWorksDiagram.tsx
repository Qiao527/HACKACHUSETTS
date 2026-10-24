export function HowItWorksDiagram() {
  const steps = [
    { x: 24, title: '1. Collect', body: ['Roof reports', 'Solar proposals', 'Utility facts'] },
    { x: 244, title: '2. Verify', body: ['Page + exact quote', 'Label estimates', 'Keep gaps visible'] },
    { x: 464, title: '3. Compare', body: ['Solar now', 'Roof + solar now', 'Roof then solar'] },
    { x: 684, title: '4. Align', body: ['Project-side NPV', 'User savings', 'Positive range'] },
    { x: 904, title: '5. Act', body: ['Share the brief', 'Resolve unknowns', 'Move viable solar'] },
  ];
  return (
    <figure className="rounded-2xl border border-mint-border bg-white p-4 sm:p-7">
      <svg viewBox="0 0 1120 250" role="img" aria-labelledby="flow-title flow-desc" className="h-auto w-full">
        <title id="flow-title">How SolarAlign works</title>
        <desc id="flow-desc">Project information is collected and verified, passed to a deterministic timing comparison, evaluated for how value reaches project sponsors and building users, and turned into an action brief.</desc>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#4fa98b" />
          </marker>
        </defs>
        {steps.map((step, index) => (
          <g key={step.title}>
            {index < steps.length - 1 && (
              <line x1={step.x + 184} y1="112" x2={step.x + 214} y2="112" stroke="#4fa98b" strokeWidth="3" markerEnd="url(#arrow)" />
            )}
            <rect x={step.x} y="30" width="184" height="164" rx="18" fill={index === 2 ? '#ccefe2' : '#e9f8f2'} stroke="#9bd6c2" strokeWidth="1.5" />
            <circle cx={step.x + 28} cy="58" r="8" fill="#16735b" />
            <text x={step.x + 44} y="64" fontFamily="Inter, sans-serif" fontSize="17" fontWeight="600" fill="#123c32">{step.title}</text>
            {step.body.map((line, lineIndex) => (
              <text key={line} x={step.x + 24} y={104 + lineIndex * 25} fontFamily="Inter, sans-serif" fontSize="13" fill="#41685e">{line}</text>
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 text-sm leading-relaxed text-ink-secondary">
        AI is optional and limited to locating evidence and drafting explanations. The schedule, NPV, savings, and value-range calculations always come from deterministic code.
      </figcaption>
    </figure>
  );
}
