import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ExternalLink, Heart, LoaderCircle, MapPin, ShieldCheck, X } from 'lucide-react';
import './ActionModal.css';

const COPY = {
  athlete: {
    eyebrow: 'THE veteRAN ATHLETE PROGRAM',
    title: 'Your miles. A bigger mission.',
    description: 'You don’t need a podium finish. Just a little purpose. Tell us about yourself and help shape our first adult athlete cohort.',
    button: 'Send my application',
    success: 'Application received.',
  },
  event: {
    eyebrow: 'FIND YOUR STARTING LINE',
    title: 'There’s a place for your pace.',
    description: 'Leave your details and we’ll follow up when the date, route, and host are confirmed. Walkers, runners, and volunteers are welcome.',
    button: 'Join the interest list',
    success: 'You’re on the interest list.',
  },
  donate: {
    eyebrow: 'THE NEXT MISSION',
    title: 'Help open the next door.',
    description: 'We’re developing a partner-led fund for veteran education and career opportunities. Be the first to hear when giving opens.',
    button: 'Notify me when giving opens',
    success: 'You’re on the giving list.',
  },
  newsletter: {
    eyebrow: 'STAY IN STRIDE',
    title: 'Be here for the first mile.',
    description: 'Get occasional updates about community runs, athlete opportunities, and the next steps for veteRAN.',
    button: 'Keep me in the loop',
    success: 'You’re part of the journey.',
  },
  privacy: {
    eyebrow: 'YOUR DETAILS. YOUR CHOICE.',
    title: 'A little trust goes a long way.',
    description: 'Here’s how we handle the information you share with veteRAN, and how to remove a submission.',
    button: 'Remove my submission',
    success: 'Request processed.',
  },
};

function Field({ label, children, optional, hint, className = '' }) {
  return <label className={`action-field ${className}`}><span className="action-field-label">{label}{optional && <span className="action-optional">Optional</span>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Consent({ name, children, required = false, checked, onChange }) {
  return <label className="action-consent"><input type="checkbox" name={name} required={required} checked={checked} onChange={onChange} /><span>{children}</span></label>;
}

function approvedDonationUrl(config) {
  if (!config?.donations?.enabled || !config?.donations?.url) return null;
  try {
    const url = new URL(config.donations.url);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

export default function ActionModal({ type = 'athlete', event, onClose, config, onComplete }) {
  const copy = COPY[type] || COPY.athlete;
  const id = useId();
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const closeRef = useRef(onClose);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [frequency, setFrequency] = useState('one-time');
  const donationUrl = approvedDonationUrl(config);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    headingRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current?.(); }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && (document.activeElement === last || document.activeElement === headingRef.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (result) headingRef.current?.focus();
  }, [result]);

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form.entries());
    const payload = { ...values, privacyConsent: form.get('privacyConsent') === 'on', updatesConsent: form.get('updatesConsent') === 'on' };
    if (type === 'athlete' || type === 'event') payload.adultConsent = form.get('adultConsent') === 'on';
    if (type === 'athlete') {
      if (values.goal) payload.goal = Number(values.goal);
      else delete payload.goal;
    }
    if (type === 'event') {
      if (!event?.id) { setError('Please choose an event from the events section first.'); return; }
      payload.eventId = event.id;
    }
    if (type === 'donate') {
      payload.amount = amount === 'custom' ? Number(customAmount) : amount;
      payload.frequency = frequency;
      if (!Number.isFinite(payload.amount) || payload.amount < 1 || payload.amount > 100000) { setError('Please enter an amount between $1 and $100,000.'); return; }
    }
    const routes = { athlete: '/api/applications', event: '/api/event-registrations', donate: '/api/donation-interest', newsletter: '/api/newsletter', privacy: '/api/privacy/withdraw' };
    setSubmitting(true);
    try {
      const response = await fetch(routes[type] || routes.athlete, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let data;
      try { data = await response.json(); } catch { throw new Error('We couldn’t save your details. Please try again in a moment.'); }
      if (!response.ok || !data.success) {
        const details = data.fields && typeof data.fields === 'object' ? Object.values(data.fields).flat().filter(value => typeof value === 'string').join(' ') : '';
        throw new Error(details || data.error || 'Something went wrong. Please try again.');
      }
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      setError(err instanceof TypeError ? 'We couldn’t reach the server. Check your connection and try again.' : err.message);
    } finally { setSubmitting(false); }
  }

  return <div className="action-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
    <section ref={dialogRef} className={`action-modal action-modal-${type}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={!result ? `${id}-description` : undefined}>
      <button className="action-modal-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={21} /></button>
      {result ? <div className="action-success">
        <div className="action-success-icon"><CheckCircle2 size={34} strokeWidth={1.5} /></div>
        <span className="action-eyebrow">A SMALL STEP. A SHARED PURPOSE.</span>
        <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{copy.success}</h2>
        <p>{result.message || 'Thanks for taking the first step with veteRAN. We’ll be in touch.'}</p>
        {type === 'event' && <p className="action-success-note">This is an expression of interest, not a race entry. We’ll share confirmed details before registration opens.</p>}
        {type === 'donate' && <p className="action-success-note">This is an interest list. No payment has been taken and no donation has been pledged.</p>}
        {result.reference && <div className="action-reference"><span>Your reference</span><strong>{result.reference}</strong></div>}
        <button className="action-submit" type="button" onClick={onClose}>Back to veteRAN <ArrowRight size={17} /></button>
      </div> : <>
        <header className="action-modal-header">
          <span className="action-eyebrow">{copy.eyebrow}</span>
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{copy.title}</h2>
          <p id={`${id}-description`}>{type === 'donate' && donationUrl ? `Give through ${config.donations.partnerName || 'our approved charitable partner'}’s secure fundraising page. You’ll choose your final amount and frequency there.` : copy.description}</p>
        </header>

        {type === 'event' && event && <div className="action-event-summary"><span className="action-event-icon"><MapPin size={20} /></span><div><strong>{event.title}</strong><span>{event.dateLabel || event.date || 'Date to be confirmed'}</span><small>{event.location || 'Princeton area · Venue to be confirmed'}</small></div><span className="action-stage-badge">PLANNED</span></div>}

        {type === 'privacy' && <div className="action-privacy-copy">
          <p><strong>Only what you choose to share.</strong> We collect your name, email, and the answers in the form you submit. We don’t ask for service records, medical details, or payment information.</p>
          <p><strong>For the project, with your permission.</strong> Organizers use your details to review applications and respond to your request. Project updates require separate consent. Your information isn’t displayed publicly or sold.</p>
          <p><strong>You stay in control.</strong> Use the email and reference from your confirmation to remove that submission and its update consent. Each submission has its own reference.</p>
          {config?.privacyContact && <p>For other privacy questions, email <a href={`mailto:${config.privacyContact}`}>{config.privacyContact}</a>.</p>}
        </div>}

        {type === 'donate' && donationUrl ? <div className="action-hosted-donation">
          <div className="action-donation-mark"><Heart size={27} strokeWidth={1.5} /></div>
          <h3>A gift with a clear path.</h3>
          <p>Payments, donor records, and any applicable receipts are handled by the receiving organization. Review the campaign details and terms on their page before giving.</p>
          <a className="action-submit" href={donationUrl} target="_blank" rel="noopener noreferrer">Continue to donate <ExternalLink size={17} /></a>
          <p className="action-secure-note"><ShieldCheck size={15} /> Opens our partner’s secure page</p>
        </div> : <form onSubmit={submit} className="action-form">
          {type === 'donate' && <div className="action-giving-options">
            <div className="action-frequency" role="group" aria-label="Giving frequency">
              <button type="button" className={frequency === 'one-time' ? 'is-selected' : ''} aria-pressed={frequency === 'one-time'} onClick={() => setFrequency('one-time')}>One-time</button>
              <button type="button" className={frequency === 'monthly' ? 'is-selected' : ''} aria-pressed={frequency === 'monthly'} onClick={() => setFrequency('monthly')}>Monthly <Heart size={13} /></button>
            </div>
            <p className="action-amount-label">What might you like to give?</p>
            <div className="action-amounts" role="group" aria-label="Potential donation amount">{[25, 50, 100, 250].map(value => <button key={value} type="button" className={amount === value ? 'is-selected' : ''} aria-pressed={amount === value} onClick={() => { setAmount(value); setCustomAmount(''); }}>${value}{amount === value && <Check size={13} />}</button>)}</div>
            <label className="action-custom-amount"><span>$</span><input type="number" min="1" max="100000" step="0.01" aria-label="Other potential donation amount in US dollars" placeholder="Other amount" value={customAmount} onFocus={() => setAmount('custom')} onChange={e => { setAmount('custom'); setCustomAmount(e.target.value); }} required={amount === 'custom'} /></label>
            <p className="action-giving-status"><span /> Giving opens after our charity partnership is confirmed. This records your interest only.</p>
          </div>}

          {type === 'privacy' ? <>
            <Field label="Email used for your submission"><input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></Field>
            <Field label="Confirmation reference" hint="Find this on the confirmation shown after your form was submitted."><input name="reference" placeholder="VR-…" autoComplete="off" maxLength={100} required /></Field>
          </> : <div className="action-field-grid">
            <Field label="Full name" optional={type === 'donate' || type === 'newsletter'}><input name="fullName" autoComplete="name" placeholder="Alex Morgan" minLength={type === 'athlete' || type === 'event' ? 2 : undefined} maxLength={120} required={type === 'athlete' || type === 'event'} /></Field>
            <Field label="Email address"><input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></Field>
          </div>}

          {type === 'athlete' && <>
            <div className="action-field-grid">
              <Field label="Your sport or activity"><select name="sport" required defaultValue=""><option value="" disabled>Select an activity</option><option value="running">Running</option><option value="walking">Walking</option><option value="cycling">Cycling</option><option value="triathlon">Triathlon</option><option value="other">Something else</option></select></Field>
              <Field label="City / state" optional><input name="location" autoComplete="address-level2" placeholder="Princeton, NJ" maxLength={150} /></Field>
            </div>
            <Field label="A challenge you have in mind" optional><input name="challenge" placeholder="My first 5K, a season of miles, a weekly walk…" maxLength={160} /></Field>
            <Field label="What brings you to veteRAN?"><textarea name="motivation" placeholder="Tell us a little about yourself and why you’d like to be involved." rows={3} minLength={10} maxLength={2000} required /></Field>
            <Field label="Potential fundraising goal ($)" optional hint="A starting idea, not a commitment. Fundraising begins only after a partner is confirmed."><input name="goal" type="number" min="1" max="100000" step="1" placeholder="500" /></Field>
          </>}

          {type === 'event' && <Field label="How would you like to join?"><select name="participation" required defaultValue=""><option value="" disabled>Choose your pace</option><option value="walk">I’d like to walk</option><option value="run">I’d like to run</option><option value="volunteer">I’d like to volunteer</option></select></Field>}

          {type === 'newsletter' && <Field label="What interests you most?" optional><select name="interest" defaultValue=""><option value="">A little of everything</option><option value="participant">Walks and runs</option><option value="athlete">Becoming an athlete</option><option value="volunteer">Volunteering</option><option value="adviser">Sharing my perspective</option><option value="organization">Partnering as an organization</option></select></Field>}

          {type !== 'privacy' && <div className="action-consents">
            {(type === 'athlete' || type === 'event') && <Consent name="adultConsent" required>I’m 18 or older. The first pilot is for adults.</Consent>}
            <Consent name="privacyConsent" required>I agree that veteRAN may store these details to respond to this request. My information won’t be displayed publicly.</Consent>
            <Consent name="updatesConsent" required={type === 'donate' || type === 'newsletter'}>{type === 'donate' ? 'Email me when giving opens. I can unsubscribe at any time.' : type === 'newsletter' ? 'Send me occasional veteRAN updates. I can unsubscribe at any time.' : 'I’d also like occasional project updates. (Optional)'}</Consent>
          </div>}
          {error && <div className="action-form-error" role="alert">{error}</div>}
          <button type="submit" className="action-submit" disabled={submitting}>{submitting ? <><LoaderCircle size={17} className="action-spin" /> Saving your details…</> : <>{copy.button}<ArrowRight size={17} /></>}</button>
          <p className="action-secure-note"><ShieldCheck size={14} /> {type === 'athlete' ? 'A private application. No public profile is created.' : type === 'event' ? 'No payment or race commitment required.' : type === 'donate' ? 'No payment details collected. No charge or pledge.' : type === 'privacy' ? 'For your privacy, we don’t reveal whether a submission was found.' : 'Occasional updates, only with your permission.'}</p>
        </form>}
      </>}
    </section>
  </div>;
}
