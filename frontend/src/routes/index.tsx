import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { XFileButton } from '@/components/xfile-button';
import { Workspace } from '@/components/workspace';
import { Comparator } from '@/components/comparator';

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: 'Untrace · CodingBros × JunctionX Lisbon' },
    { name: 'description', content: 'Untrace: the CodingBros document anonymization interface for JunctionX Lisbon 2026.' },
    { property: 'og:title', content: 'Untrace — CodingBros' },
    { property: 'og:description', content: 'Untrace: protect your data. Preserve the context. A document review frontend for JunctionX Lisbon 2026.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { property: 'og:url', content: '/' },
  ], links: [{ rel: 'canonical', href: '/' }] }),
});

function HeroTitle() {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (reduced) { setRevealed(true); return; }
    const timer = setTimeout(() => setRevealed(true), 800);
    return () => clearTimeout(timer);
  }, [reduced]);
  let index = 0;
  const reveal = (text: string) => text.split(' ').map((word, wi) => <span key={wi}><span className="title-word">{Array.from(word).map((letter, li) => {
    const delay = index++ * .011;
    return <motion.span className="letter" key={li} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .22, delay: reduced ? 0 : delay }}>{letter}</motion.span>;
  })}</span>{wi < text.split(' ').length - 1 ? ' ' : ''}</span>);
  return <h1 id="hero-title" aria-label="Protect your data. Preserve the context."><span aria-hidden="true">{revealed ? <>Protect your data.<br />Preserve the <em>context.</em></> : <>{reveal('Protect your data.')}<br />{reveal('Preserve the')} <em>{reveal('context.')}</em></>}</span></h1>;
}

function Index() {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => { const mql = window.matchMedia('(max-width: 800px)'); const update = () => setMobileNav(mql.matches); update(); mql.addEventListener('change', update); return () => mql.removeEventListener('change', update); }, []);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 12); onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  const steps = [
    ['01 / UPLOAD', 'Choose your PDF.', 'Choose a document you are authorized to use. It stays in your browser until you start the analysis.'],
    ['02 / ANALYZE', 'Let the engine do the work.', 'The app connects to the same Python logic that will power the team’s submission.'],
    ['03 / REVIEW', 'Compare and download.', 'Review the text and the changes reported by the engine. Download the exact result as a TXT file.'],
  ];
  return (
    <>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className={`header${scrolled ? ' scrolled' : ''}`}>
        <a className="brand" href="#home" aria-label="Untrace — home"><span className="brand-mark" aria-hidden="true" /><span>Untrace<small>by CodingBros</small></span></a>
        {mobileNav ? <AnimatePresence>{navOpen && <motion.nav key="mobile-nav" className="mobile-open" aria-label="Main navigation" onClick={() => setNavOpen(false)} initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }} transition={{ duration: reduced ? 0 : .22 }}><a className="active" href="#workspace">Anonymize</a><a href="#how-it-works">How it works</a></motion.nav>}</AnimatePresence> : <nav aria-label="Main navigation" onClick={() => setNavOpen(false)}><a className="active" href="#workspace">Anonymize</a><a href="#how-it-works">How it works</a></nav>}
        <div className="event-lockup" aria-label="NOS · JunctionX Lisbon 2026"><span className="nos-word" aria-hidden="true">N<span className="nos-ring" />S</span><span>JUNCTIONX<small>LISBON 2026</small></span></div>
        <XFileButton className="icon-button mobile-nav-toggle" aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>{navOpen ? <X /> : <Menu />}</XFileButton>
      </header>
      <main id="home" className="container">
        <section className="hero" aria-labelledby="hero-title"><div><motion.div className="eyebrow" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { duration: .25, delay: .85 }}><span /> CALL FOR ANONYMIZING PROMPTS</motion.div><HeroTitle /><motion.p initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { duration: .25, delay: 1.05 }}>From PDF to anonymized text, powered by the team’s AI engine.<br />Review every change and stay in control of the result.</motion.p><motion.a className="text-link" href="#workspace" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { duration: .25, delay: 1.18 }} whileHover={reduced ? {} : { scale: 1.02 }} whileTap={reduced ? {} : { scale: .98 }}>Start with a document <span aria-hidden="true">↓</span></motion.a></div><div className="hero-aside"><motion.div className="sunburst-wrap" aria-hidden="true" initial={reduced ? false : { opacity: 0, rotate: -10 }} animate={{ opacity: 1, rotate: 0 }} transition={reduced ? { duration: 0 } : { duration: .5, delay: .35, ease: 'easeOut' }}><div className="sunburst" /><span className="giant-star">*</span></motion.div><p>One word.<br /><strong>One asterisk.</strong></p><span className="art-caption">PRIVACY WITH CONTEXT / 2026</span></div></section>
        <Comparator />
        <Workspace />
        <motion.section id="how-it-works" className="how-it-works" aria-labelledby="how-title" initial={reduced ? false : 'hidden'} whileInView="visible" viewport={{ once: true, amount: .15 }} variants={{ hidden: {}, visible: { transition: { staggerChildren: reduced ? 0 : .1 } } }}>
          <motion.div className="section-intro" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: .3 } } }}><span className="eyebrow">ONE SIMPLE WORKFLOW</span><h2 id="how-title">From upload to review.<br />Always with context.</h2></motion.div>
          {steps.map(([number, title, text]) => <motion.div className="how-step" key={number} variants={{ hidden: { opacity: 0, y: reduced ? 0 : 12 }, visible: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : .3 } } }}><span>{number}</span><h3>{title}</h3><p>{text}</p></motion.div>)}
        </motion.section>
        <motion.section className="project-note" initial={reduced ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .3 }}><span className="note-star" aria-hidden="true">✳</span><div><h2>Faz o que ninguém Fez</h2><p>A CodingBros project for JunctionX Lisbon 2026. Text masking alone does not guarantee legal anonymity. Review results against the team’s policy.</p></div><a href="https://lisbon.hackjunction.com/assets/challenges/NOS%20-%20JunctionX%20Lisbon%202026.pdf" target="_blank" rel="noopener noreferrer">Official challenge brief <span aria-hidden="true">↗</span></a></motion.section>
      </main>
      <motion.footer className="footer container" initial={reduced ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .3 }}><div><strong>Untrace</strong><span>Less exposure. More context.</span></div><p>JunctionX Lisbon 2026 · CodingBros<br />An independent project. Not an official NOS service.</p><a href="#home" aria-label="Back to top">↑</a></motion.footer>
    </>
  );
}
