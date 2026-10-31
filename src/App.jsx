import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, ArrowDown, Heart, Footprints, Users, MapPin, CalendarDays, Flag, Menu, X, Check, MoveUpRight, Sprout, Accessibility, ShieldCheck, Mail, LoaderCircle } from 'lucide-react';
import ActionModal from './components/ActionModal.jsx';
import Organizer from './components/Organizer.jsx';

function Brand({ light = false }) {
  return <a className={`brand ${light ? 'brand-light' : ''}`} href="/" aria-label="veteRAN home"><svg viewBox="0 0 38 40" aria-hidden="true"><path d="m4 12 13 24L34 4M12 12h17M16 20h9" /></svg><span>vete<span className="brand-caps">RAN</span><span className="brand-period">.</span></span></a>;
}

const programs = [
  { number: '01', icon: Footprints, tag: 'FOR EVERY PACE', title: 'Find your starting line.', text: 'Walk, run, or simply come for the company. Make room for new connections at our community events.', action: 'Explore events', target: 'events', color: 'sage' },
  { number: '02', icon: Flag, tag: 'FOR THE GO-GETTERS', title: 'Make your miles matter.', text: 'Turn your next challenge into something bigger. Apply to become a veteRAN athlete and help shape our first team.', action: 'Become an athlete', modal: 'athlete', color: 'sand' },
  { number: '03', icon: Heart, tag: 'FOR WHAT COMES NEXT', title: 'Back a new beginning.', text: 'Help build a path toward education and career opportunities for veterans. Join the list for future giving.', action: 'Explore giving', modal: 'donate', color: 'blush' },
];

const faqs = [
  ['Do I need to be a veteran or an experienced runner?', 'Neither. Veterans and civilians are equally welcome, and you don’t need to run fast—or run at all. Our first community pilot is being designed with walking and social participation in mind.'],
  ['What does becoming a veteRAN athlete involve?', 'Tell us a little about yourself and a challenge you’d like to take on. Our organizers will review your application as we build the adult pilot. Fundraising pages and goals will come later, once our charitable partner and program are approved.'],
  ['Can I register for a race now?', 'You can join an event’s interest list today. The events shown here are proposals, with dates and venues still to be confirmed. Joining a list doesn’t reserve a race entry or charge a fee. We’ll share confirmed details if you opt in to updates.'],
  ['Where will donations go?', 'We’re exploring a partner-led program for veteran-defined education and career needs. We are not accepting payments yet. Before giving opens, we’ll name the receiving organization and explain the program, fees, and use of funds.'],
  ['Can students under 18 participate?', 'The initial application and event interest forms are for adults aged 18 and over. School participation will need a separate approved process with school and guardian permission.'],
];

function RouteArtwork({ kind }) {
  return <div className={`route-art route-${kind}`} aria-hidden="true"><div className="map-grid" /><svg viewBox="0 0 360 150"><path className="route-shadow" d={kind === 'race' ? 'M58 114C55 48 107 53 123 75S159 127 191 95s1-60 41-61 45 27 73 6' : kind === 'challenge' ? 'M50 107c45 0 11-69 61-69s4 72 61 72 18-65 70-65 31 33 66 33' : 'M53 115c6-60 43-18 58-61s57-15 66 11 56 38 65 2 43-21 65-38'} /><circle cx={kind === 'race' ? 58 : kind === 'challenge' ? 50 : 53} cy={kind === 'race' ? 114 : kind === 'challenge' ? 107 : 115} r="7"/><circle className="route-end" cx={kind === 'race' ? 305 : kind === 'challenge' ? 308 : 307} cy={kind === 'race' ? 40 : kind === 'challenge' ? 78 : 29} r="7"/></svg><span className="map-label">{kind === 'race' ? 'THE NEXT CHAPTER' : kind === 'challenge' ? 'YOUR ROUTE. YOUR REASON.' : 'A LITTLE FURTHER, TOGETHER.'}</span><span className="map-cross">+</span></div>;
}

export default function App() {
  if (window.location.pathname.startsWith('/organizer')) return <Organizer />;
  return <Website />;
}

function Website() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [config, setConfig] = useState({ donations: { enabled: false } });
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [email, setEmail] = useState('');
  const [newsletter, setNewsletter] = useState({ status: 'idle', message: '' });
  const footerConsent = useRef(null);

  const loadEvents = async () => {
    setEventsError(false);
    try {
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : data.events);
    } catch { setEventsError(true); }
  };
  useEffect(() => {
    loadEvents();
    fetch('/api/config').then(r => r.ok ? r.json() : Promise.reject()).then(setConfig).catch(() => {});
  }, []);

  function open(type, event) { setMobileMenu(false); setModal({ type, event }); }
  async function subscribe(event) {
    event.preventDefault();
    setNewsletter({ status: 'loading', message: '' });
    try {
      const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, privacyConsent: true, updatesConsent: true, interest: 'community' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We couldn’t save your signup. Please try again.');
      setNewsletter({ status: 'success', message: `You’re on the list. Keep your reference: ${data.reference}` });
      setEmail('');
    } catch (error) { setNewsletter({ status: 'error', message: error.message || 'Please check your connection and try again.' }); }
  }

  const filteredEvents = events.filter(event => filter === 'all' || (filter === 'community' ? event.type === 'community' || event.id === 'together-pilot' : event.type === 'challenge' || event.id === 'athlete-challenge'));

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="announcement"><span>A SHARED PURPOSE. A NEW START.</span><span>Veterans + civilians. Moving forward, together. <ArrowUpRight size={13} /></span></div>
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className={mobileMenu ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          <a href="#mission" onClick={() => setMobileMenu(false)}>Our mission</a>
          <a href="#programs" onClick={() => setMobileMenu(false)}>Get involved</a>
          <a href="#events" onClick={() => setMobileMenu(false)}>Events <span className="nav-dot" /></a>
          <a href="#impact" onClick={() => setMobileMenu(false)}>The difference</a>
          <button className="mobile-donate" onClick={() => open('donate')}>Support the mission <ArrowUpRight size={16} /></button>
        </nav>
        <button className="button button-navy header-cta" onClick={() => open('donate')}>Support the mission <ArrowUpRight size={16} /></button>
        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenu}>{mobileMenu ? <X /> : <Menu />}</button>
      </div>
    </header>

    <main id="main">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> ONE COMMUNITY. COUNTLESS POSSIBILITIES.</p>
          <h1 id="hero-title">Every mile,<br />a new <em>beginning.</em></h1>
          <p className="hero-description">They ran. So we run. Bringing veterans and civilians together through movement, connection, and a purpose that goes beyond the finish line.</p>
          <div className="hero-actions"><button className="button button-orange" onClick={() => open('athlete')}>Find your purpose <ArrowUpRight size={18} /></button><a className="text-link" href="#events">Find your people <ArrowRight size={17} /></a></div>
          <div className="hero-welcome"><span className="welcome-icon"><Users size={19} /></span><p>Every background. Every ability. <strong>Every pace welcome.</strong></p></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo"><img src="/images/community-run.png" alt="An illustrative scene of adults jogging together along a sunlit autumn trail" fetchPriority="high" /><div className="photo-gradient" /><span className="photo-caption"><span className="small-plus">+</span> STRONGER, SIDE BY SIDE.</span></div>
          <div className="hero-stamp"><svg viewBox="0 0 110 110" aria-hidden="true"><defs><path id="stamp-circle" d="M55,55m-40,0a40,40 0 1,1 80,0a40,40 0 1,1 -80,0" /></defs><text><textPath href="#stamp-circle" startOffset="0">EVERY PACE. EVERY PERSON. EVERY PACE. </textPath></text></svg><Footprints size={31} strokeWidth={1.5} /></div>
          <div className="hero-note"><span className="note-mark"><MoveUpRight size={29} /></span><div>Different paths.<br /><strong>One starting line.</strong></div><span className="note-index">EST.<br />2026</span></div>
        </div>
        <a className="scroll-cue" href="#mission"><ArrowDown size={14} /> A LITTLE MOVEMENT. A LOT OF POSSIBILITY.</a>
      </section>

      <section className="mission-strip" id="mission" aria-labelledby="mission-title"><div className="container mission-strip-inner"><div className="mission-motto"><span className="asterisk">✳</span><h2 id="mission-title">They ran.<br /><em>So we run.</em></h2></div><p>Service is part of their story.<br /><strong>What comes next should be full of possibility.</strong></p><a href="#our-story" className="round-link" aria-label="Read our story"><ArrowUpRight size={25} /></a></div></section>

      <section className="section container programs-section" id="programs" aria-labelledby="programs-title">
        <div className="section-heading"><div><p className="eyebrow">THERE’S A PLACE FOR YOU HERE</p><h2 id="programs-title">One mission. <em>Many ways to move.</em></h2></div><p>You don’t have to run a marathon to make a difference.<br className="desktop-break" /> Just take your first step.</p></div>
        <div className="program-grid">{programs.map(({ number, icon: Icon, tag, title, text, action, target, modal: modalType, color }) => <article className={`program-card ${color}`} key={number}><div className="program-top"><span className="program-icon"><Icon size={26} strokeWidth={1.5} /></span><span className="card-number">/ {number}</span></div><p className="eyebrow">{tag}</p><h3>{title}</h3><p className="card-description">{text}</p>{target ? <a className="card-action" href={`#${target}`}>{action}<ArrowUpRight size={20} /></a> : <button className="card-action" onClick={() => open(modalType)}>{action}<ArrowUpRight size={20} /></button>}</article>)}</div>
      </section>

      <section className="story-section container" id="our-story" aria-labelledby="story-title"><div className="story-art"><div className="story-topline"><span>THE veteRAN WAY</span><span>01 — TOGETHER</span></div><svg className="story-trail" viewBox="0 0 440 350" aria-hidden="true"><path d="M-20 290C140 340 40 90 190 160S330 320 320 120s75-55 130-100" /><circle cx="190" cy="160" r="10"/><circle cx="320" cy="120" r="10"/></svg><p>Different stories.<br />Common ground.</p><span className="story-bottomline">COME AS YOU ARE. GO FURTHER TOGETHER.</span></div><div className="story-copy"><p className="eyebrow">THE REASON BEHIND THE RUN</p><h2 id="story-title">Connection today.<br /><em>Opportunity tomorrow.</em></h2><p>We believe the best next chapters start with community. veteRAN is a developing initiative connecting veterans and civilians through accessible runs, walks, and shared experiences.</p><p>Founded by Nathan Kim and John, we’re listening to veterans first—and exploring how athlete-led fundraising can help open doors to education and careers.</p><div className="story-principles"><span><Accessibility size={19} /> Every pace belongs</span><span><Users size={19} /> Shaped by veteran voices</span><span><Sprout size={19} /> Built with purpose</span></div><button className="text-link" onClick={() => open('newsletter')}>Help shape what comes next <ArrowUpRight size={18} /></button></div></section>

      <section className="events-section section" id="events" aria-labelledby="events-title"><div className="container"><div className="section-heading"><div><p className="eyebrow">GOOD COMPANY. A SHARED STARTING LINE.</p><h2 id="events-title">See you <em>out there.</em></h2></div><p>Our first chapter is taking shape.<br />Be the first to know when we’re ready to go.</p></div><div className="events-toolbar"><div className="event-filters" role="group" aria-label="Filter events">{[['all', 'All events'], ['community', 'Community runs'], ['challenge', 'Athlete challenges']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>)}</div><span className="event-status"><span /> IN THE MAKING</span></div>
        {eventsError ? <div className="events-empty" role="alert"><CalendarDays size={30} /><h3>The starting line is still here.</h3><p>We couldn’t load the event list. Please try again.</p><button className="button button-navy" onClick={loadEvents}>Try again <ArrowRight size={16} /></button></div> : !events.length ? <div className="events-empty" aria-live="polite"><LoaderCircle className="spin" /><p>Finding your next starting line…</p></div> : <div className="events-grid">{filteredEvents.map((event, index) => { const kind = event.id === 'spring-5k' ? 'race' : event.id === 'athlete-challenge' ? 'challenge' : 'community'; return <article className="event-card" key={event.id}><div className="event-image"><RouteArtwork kind={kind} /><span className="event-badge">{kind === 'challenge' ? 'ATHLETE CHALLENGE' : kind === 'race' ? 'COMMUNITY 5K' : 'RUN + WALK'}</span><span className="event-distance">{event.distance || 'All paces'}</span></div><div className="event-body"><span className="event-date"><CalendarDays size={14} />{event.date || event.dateLabel || 'Date to be confirmed'}</span><h3>{event.title}</h3><p className="event-location"><MapPin size={15} />{event.location}</p><p className="event-description">{event.description || 'A shared starting line for veterans, civilians, and everyone ready to move forward together.'}</p><button className="card-action" onClick={() => open('event', event)}>Join the interest list <ArrowUpRight size={20} /></button></div></article>; })}</div>}
        <p className="events-note"><CalendarDays size={15} /> All events are proposed. Dates, venues, and registration will be shared once confirmed. No fees are collected.</p>
      </div></section>

      <section className="impact-section container section" id="impact" aria-labelledby="impact-title"><div className="impact-intro"><p className="eyebrow">PURPOSE YOU CAN FOLLOW</p><h2 id="impact-title">Small steps.<br /><em>A meaningful difference.</em></h2><p>We’re at the beginning. No inflated numbers. No promises ahead of progress. Here’s the path we’re working toward.</p><span className="transparency-label"><ShieldCheck size={17} /> OPEN FROM THE START</span></div><div className="impact-steps">{[['01', 'Listen first.', 'Learn from veterans about the connections, education, and career opportunities that matter to them.'], ['02', 'Move together.', 'Build a welcoming community through an adult run/walk pilot and a small team of purpose-driven athletes.'], ['03', 'Open new doors.', 'Work toward an approved charitable partnership, clear giving information, and transparent progress reports.']].map(([n, title, text]) => <div className="impact-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight size={21} /></div>)}</div></section>

      <section className="giving-section container" aria-labelledby="giving-title"><div className="giving-copy"><p className="eyebrow">A PURPOSE BEYOND THE FINISH LINE</p><h2 id="giving-title">Help write<br /><em>the next chapter.</em></h2><p>A course. A certification. A new direction. Help us explore a future where community-powered giving supports veterans’ education and career opportunities.</p><button className="button button-cream" onClick={() => open('donate')}>{config.donations?.enabled ? 'Support the mission' : 'Be part of what’s next'}<ArrowUpRight size={18} /></button><span className="giving-note">{config.donations?.enabled ? `Giving through ${config.donations.partnerName}.` : 'Giving is not open yet. Join the list for updates.'}</span></div><div className="giving-art" aria-hidden="true"><svg viewBox="0 0 350 350"><g fill="none" stroke="currentColor" strokeWidth="1.4">{Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx="175" cy="175" rx="46" ry="143" transform={`rotate(${i * 15} 175 175)`} />)}</g><circle cx="175" cy="175" r="47" fill="#e9c982"/><path d="m155 178 14 14 26-30" stroke="#142b37" strokeWidth="3" fill="none"/></svg><span>ROOTED IN SERVICE.<br />GROWING THROUGH COMMUNITY.</span></div></section>

      <section className="faq-section container section" aria-labelledby="faq-title"><div className="faq-heading"><p className="eyebrow">BEFORE YOU LACE UP</p><h2 id="faq-title">A few things<br /><em>you might wonder.</em></h2><p>A new initiative. An open conversation.<br />Let’s start on the same page.</p></div><div className="faq-list">{faqs.map(([question, answer], i) => <details key={question}><summary><span className="faq-index">0{i + 1}</span>{question}<span className="faq-toggle">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="closing-strip"><div className="container"><Footprints size={30} strokeWidth={1.4} /><p>Your pace. Your people. <em>Your purpose.</em></p><button onClick={() => open('athlete')} aria-label="Apply to become an athlete"><ArrowUpRight size={26} /></button></div></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-main"><div className="footer-brand"><Brand light /><p>They ran. So we run.<br />Moving forward, together.</p><span className="footer-location"><MapPin size={14} /> Taking root in Princeton, NJ</span></div><div className="footer-links"><h3>EXPLORE</h3><a href="#mission">Our mission</a><a href="#events">Upcoming events</a><a href="#impact">Our approach</a></div><div className="footer-links"><h3>TAKE A STEP</h3><button onClick={() => open('athlete')}>Become an athlete</button><button onClick={() => open('donate')}>Future giving</button><button onClick={() => open('newsletter')}>Volunteer & connect</button></div><div className="footer-newsletter"><h3>STAY IN STEP</h3><p>A little news. A lot of purpose.<br />Get project and event updates.</p><form onSubmit={subscribe}><label className="sr-only" htmlFor="footer-email">Email address</label><div className="newsletter-input"><input id="footer-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" required autoComplete="email" maxLength={254} disabled={newsletter.status === 'loading'} /><button disabled={newsletter.status === 'loading'} aria-label="Subscribe to updates">{newsletter.status === 'loading' ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={21} />}</button></div><label className="newsletter-consent"><input ref={footerConsent} type="checkbox" required /> <span>I agree to receive updates and to the <button type="button" onClick={() => open('privacy')}>privacy information</button>.</span></label><p className={`newsletter-message ${newsletter.status}`} role="status">{newsletter.message}</p></form></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} veteRAN. A developing community initiative.</span><div><button onClick={() => open('privacy')}>Privacy & your data</button>{config.privacyContact && <a href={`mailto:${config.privacyContact}`}>Contact us <Mail size={12} /></a>}</div></div><p className="affiliation">Not presented as endorsed by Princeton University or the U.S. Army. Fundraising and events are in development.</p></div></footer>
    {modal && <ActionModal key={`${modal.type}-${modal.event?.id || ''}`} type={modal.type} event={modal.event} config={config} onClose={() => setModal(null)} />}
  </>;
}
