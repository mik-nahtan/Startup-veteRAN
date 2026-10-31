import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, Heart, KeyRound, LoaderCircle, LockKeyhole, LogOut, Mail, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react';
import './Organizer.css';

const GROUPS = [
  { id: 'applications', label: 'Athlete applications', short: 'Applications', icon: Users },
  { id: 'event-registrations', label: 'Event interest', short: 'Event interest', icon: CalendarDays },
  { id: 'donation-interest', label: 'Giving interest', short: 'Giving interest', icon: Heart },
  { id: 'newsletter', label: 'Project updates', short: 'Updates', icon: Mail },
];

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function api(path, token, asBlob = false) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(response.status === 401
      ? 'Access was not granted. Check your organizer token. The server needs an ADMIN_TOKEN of at least 24 characters to enable organizer access.'
      : result.error || 'We could not load these records. Please try again.');
    error.status = response.status;
    throw error;
  }
  return asBlob ? response.blob() : response.json();
}

function Details({ record, kind, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    function keydown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(element => !element.disabled);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', keydown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [onClose]);
  const entries = Object.entries(record).filter(([key]) => !['fullName', 'email', 'createdAt'].includes(key));
  return <div className="organizer-detail-shade" onClick={onClose}>
    <section ref={dialogRef} className="organizer-detail" role="dialog" aria-modal="true" aria-labelledby="record-title" onClick={event => event.stopPropagation()}>
      <button ref={closeRef} className="organizer-icon-button organizer-detail-close" aria-label="Close submission details" onClick={onClose}><X size={22}/></button>
      <p className="organizer-eyebrow">{GROUPS.find(group => group.id === kind)?.label}</p>
      <h2 id="record-title">{record.fullName || 'Community member'}</h2>
      <a className="organizer-email" href={`mailto:${record.email}`}>{record.email}</a>
      <p className="organizer-detail-date">Received {displayDate(record.createdAt)}</p>
      <dl>{entries.map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</dt><dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—')}</dd></div>)}</dl>
    </section>
  </div>;
}

export default function Organizer() {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [overview, setOverview] = useState(null);
  const [group, setGroup] = useState('applications');
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [recordsError, setRecordsError] = useState('');
  const [selected, setSelected] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => { document.title = 'Organizer portal — veteRAN'; }, []);

  useEffect(() => {
    if (!token) return;
    let current = true;
    setRecordsLoading(true);
    setRecordsError('');
    setRecords([]);
    api(`/api/admin/export?type=${group}`, token)
      .then(data => { if (current) setRecords(data.records || []); })
      .catch(err => { if (current) setRecordsError(err.message); })
      .finally(() => { if (current) setRecordsLoading(false); });
    return () => { current = false; };
  }, [token, group, refreshVersion]);

  async function login(event) {
    event.preventDefault();
    setError('');
    setLoginLoading(true);
    try {
      const result = await api('/api/admin/overview', tokenInput.trim());
      setOverview(result);
      setToken(tokenInput.trim());
      setTokenInput('');
      setTimeout(() => headingRef.current?.focus(), 0);
    } catch (err) { setError(err.message); }
    finally { setLoginLoading(false); }
  }

  function logout() {
    setToken(''); setTokenInput(''); setOverview(null); setRecords([]); setSelected(null); setQuery(''); setError(''); setRecordsError('');
  }

  async function refresh() {
    setRecordsError('');
    try { setOverview(await api('/api/admin/overview', token)); setRefreshVersion(version => version + 1); }
    catch (err) { setRecordsError(err.message); }
  }

  async function downloadCsv() {
    setDownloading(true); setRecordsError('');
    try {
      const blob = await api(`/api/admin/export?type=${group}&format=csv`, token, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `veteran-${group}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setRecordsError(err.message); }
    finally { setDownloading(false); }
  }

  const visible = useMemo(() => records.filter(record =>
    `${record.fullName || ''} ${record.email || ''} ${record.reference || ''}`.toLowerCase().includes(query.toLowerCase())
  ), [records, query]);
  const active = GROUPS.find(item => item.id === group);
  const ActiveIcon = active.icon;

  return <div className="organizer-page">
    <header className="organizer-header">
      <a href="/" className="organizer-brand" aria-label="veteRAN home">vete<span>RAN</span><i> / organizer</i></a>
      <div className="organizer-header-actions"><a href="/"><ArrowLeft size={15}/> Back to the website</a>{token && <button onClick={logout}><LogOut size={16}/> Sign out</button>}</div>
    </header>
    {!token ? <main className="organizer-login-wrap">
      <div className="organizer-login-intro"><span className="organizer-lock"><LockKeyhole size={25}/></span><p className="organizer-eyebrow">FOR THE PEOPLE BEHIND THE MILES</p><h1>A little organization.<br/><em>A bigger purpose.</em></h1><p>A private space for athlete applications, event interest, and the community you’re building.</p></div>
      <form className="organizer-login-card" onSubmit={login}>
        <div className="organizer-card-heading"><ShieldCheck size={23}/><span>Organizer access</span></div>
        <h2>Welcome back.</h2><p>Use your private organizer token to view submissions.</p>
        <label htmlFor="organizer-token">Organizer token</label>
        <div className="organizer-token-input"><KeyRound size={18}/><input id="organizer-token" type="password" required autoComplete="off" spellCheck="false" value={tokenInput} onChange={event => setTokenInput(event.target.value)} placeholder="Enter your private access token"/></div>
        {error && <p role="alert" className="organizer-error">{error}</p>}
        <button type="submit" className="organizer-primary" disabled={loginLoading}>{loginLoading ? <><LoaderCircle className="organizer-spin" size={18}/> Checking access…</> : <>Open organizer dashboard <ArrowRight size={18}/></>}</button>
        <div className="organizer-security-note"><LockKeyhole size={15}/><p>Your token stays in this page’s memory and is cleared when you sign out or refresh.</p></div>
      </form>
    </main> : <main className="organizer-dashboard">
      <div className="organizer-dashboard-heading"><div><p className="organizer-eyebrow">YOUR COMMUNITY, AT A GLANCE</p><h1 ref={headingRef} tabIndex={-1}>Good things start <em>together.</em></h1><p>Review interest, meet your future athletes, and keep the next chapter moving.</p></div><button className="organizer-secondary" onClick={refresh}><RefreshCw size={16}/> Refresh</button></div>
      <div className="organizer-counts">{GROUPS.map(item => { const Icon = item.icon; return <button key={item.id} className={group === item.id ? 'is-active' : ''} onClick={() => { setGroup(item.id); setQuery(''); }}><Icon size={21}/><strong>{overview?.counts?.[item.id] ?? 0}</strong><span>{item.label}</span><ArrowRight className="organizer-count-arrow" size={17}/></button>; })}</div>
      <section className="organizer-records" aria-label="Community submissions">
        <div className="organizer-tabs" role="tablist" aria-label="Submission category">{GROUPS.map(item => <button key={item.id} role="tab" aria-selected={group === item.id} onClick={() => { setGroup(item.id); setQuery(''); }}>{item.short}<span>{overview?.counts?.[item.id] ?? 0}</span></button>)}</div>
        <div className="organizer-record-toolbar"><div><h2>{active.label}</h2><p>{recordsLoading ? 'Loading your submissions…' : `${records.length} ${records.length === 1 ? 'submission' : 'submissions'} received`}</p></div><div className="organizer-record-actions"><label className="organizer-search"><Search size={17}/><input aria-label="Search submissions by name, email, or reference" placeholder="Search name or email" value={query} onChange={event => setQuery(event.target.value)}/></label><button className="organizer-secondary" onClick={downloadCsv} disabled={downloading}>{downloading ? <LoaderCircle className="organizer-spin" size={16}/> : <ArrowDownToLine size={16}/>} Export CSV</button></div></div>
        {recordsError && <p role="alert" className="organizer-error organizer-record-error">{recordsError}</p>}
        {recordsLoading ? <div className="organizer-empty" role="status"><LoaderCircle className="organizer-spin" size={28}/><p>Loading submissions…</p></div> : visible.length ? <div className="organizer-table-scroll"><table><thead><tr><th>Name & email</th><th>{group === 'applications' ? 'Sport / challenge' : group === 'event-registrations' ? 'Event' : group === 'donation-interest' ? 'Giving preference' : 'Interest'}</th><th>Received</th><th>Status</th><th><span className="organizer-sr-only">View details</span></th></tr></thead><tbody>{visible.map(record => <tr key={record.reference}><td><strong>{record.fullName || 'Community member'}</strong><span>{record.email}</span></td><td>{group === 'applications' ? record.sport || record.challenge || '—' : group === 'event-registrations' ? record.eventId?.replaceAll('-', ' ') || '—' : group === 'donation-interest' ? `$${record.amount} · ${record.frequency}` : record.interest || 'Project updates'}</td><td>{displayDate(record.createdAt)}</td><td><span className="organizer-status"><span/>{record.status === 'waitlisted' ? 'Interest list' : record.status}</span></td><td><button className="organizer-view-button" onClick={() => setSelected(record)}>View <ArrowRight size={14}/></button></td></tr>)}</tbody></table></div> : <div className="organizer-empty"><span className="organizer-empty-icon"><ActiveIcon size={27}/></span><h3>{query ? 'No matching submissions.' : 'The starting line is ready.'}</h3><p>{query ? 'Try a different name, email address, or reference.' : 'New submissions will appear here when someone fills out a form on your website.'}</p>{query && <button className="organizer-secondary" onClick={() => setQuery('')}>Clear search</button>}</div>}
      </section>
      <p className="organizer-dashboard-note"><ShieldCheck size={15}/> These records are private. Share exports only with authorized organizers. Interest in an event or donation is not a confirmed entry or a payment.</p>
    </main>}
    <footer className="organizer-footer"><span>veteRAN · Every mile, a new beginning.</span><span><LockKeyhole size={13}/> Private organizer workspace</span></footer>
    {selected && <Details record={selected} kind={group} onClose={() => setSelected(null)}/>}
  </div>;
}
