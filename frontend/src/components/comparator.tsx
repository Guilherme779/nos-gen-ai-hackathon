import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const mask = (value: string) => value.split(/\s+/).map(word => '*' + (word.match(/[.,;:]+$/)?.[0] ?? '')).join(' ');

const SWEEP_MIN = 8;
const SWEEP_MAX = 92;

function Declaration({ censored = false }: { censored?: boolean }) {
  const field = (value: string) => <span className="declaration-field">{censored ? mask(value) : value}</span>;
  return <div className={`declaration${censored ? ' censored' : ''}`} aria-hidden="true" lang="pt">
    <h3>Declaração</h3>
    <p>Eu, {field('João Pedro Almeida')}</p>
    <p>portador do NIF {field('198 452 330')}</p>
    <p>residente em {field('Rua das Flores 12, Porto')}</p>
    <p>contacto {field('912 345 678')}</p>
    <p>declaro aceitar as condições do contrato.</p>
  </div>;
}

export function Comparator() {
  const [position, setPosition] = useState(50);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(true);
  const [hovering, setHovering] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const resume = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const direction = useRef(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = stage.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => setVisible(Boolean(entries[0]?.isIntersecting)), { threshold: .1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || reduced || !visible) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const delta = Math.min(.1, (now - last) / 1000);
      last = now;
      setPosition(previous => {
        let next = previous + direction.current * delta * 20;
        if (next >= SWEEP_MAX) { next = 2 * SWEEP_MAX - next; direction.current = -1; } else if (next <= SWEEP_MIN) { next = 2 * SWEEP_MIN - next; direction.current = 1; }
        return Math.round(next * 10) / 10;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [auto, reduced, visible]);

  useEffect(() => () => clearTimeout(resume.current), []);

  const interact = () => {
    setAuto(false);
    clearTimeout(resume.current);
    resume.current = setTimeout(() => setAuto(true), 5000);
  };

  const drag = (event: PointerEvent<HTMLInputElement>) => {
    const bounds = stage.current?.getBoundingClientRect();
    if (bounds) setPosition(Math.round(Math.min(100, Math.max(0, (event.clientX - bounds.left) / bounds.width * 100))));
  };
  return <motion.section className="comparison-section" aria-labelledby="comparison-title" initial={reduced ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .35 }}>
    <div className="comparison-heading"><div><span className="eyebrow">PRIVACY WITH CONTEXT</span><h2 id="comparison-title">The context stays. The personal data doesn’t.</h2></div><p>A fictitious example. Your uploaded document is reviewed separately, with the exact text returned by the engine.</p></div>
    <div className="comparison-labels" lang="pt"><span>Original</span><span>Censurado</span></div>
    <div className="comparison-stage" ref={stage} onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)}>
      <Declaration censored />
      <div className="comparison-original" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><Declaration /></div>
      <div className="comparison-divider" style={{ left: `${position}%` }}><motion.span className="comparison-handle" style={{ x: '-50%', y: '-50%' }} animate={{ scale: hovering && !reduced ? 1.06 : 1 }} transition={{ type: 'spring', duration: .22, bounce: .15 }} /></div>
      <label className="sr-only" htmlFor="comparison-slider">Original and censored comparison</label>
      <input id="comparison-slider" className="comparison-range" type="range" min="0" max="100" step="1" value={Math.round(position)} aria-valuetext={`${Math.round(position)}% original, ${100 - Math.round(position)}% censored`} onChange={event => { interact(); setPosition(Number(event.target.value)); }} onPointerDown={event => { event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); interact(); drag(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) drag(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
    </div>
    <p className="comparison-caption" lang="pt">Exemplo fictício.</p>
    <p className="sr-only">Original declaration: João Pedro Almeida, NIF 198 452 330, Rua das Flores 12, Porto, contacto 912 345 678. The censored declaration replaces only these fields, one asterisk per word or number.</p>
  </motion.section>;
}