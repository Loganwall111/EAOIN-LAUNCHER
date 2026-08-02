/**
 * HorizonOS Mail — a working in-OS email client.
 *
 * Inbox list + a reading pane. Messages reference the EAOIN world (server
 * notices, dimension alerts, Onblockaway studio news). Compose opens a simple
 * new-message form that can "send" a copy to the Sent list.
 */
import { useState } from 'react';

interface MailMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  starred?: boolean;
}

const INITIAL: MailMessage[] = [
  { id: 'm1', from: 'HorizonOS', subject: 'Welcome on board', preview: 'Your desktop is ready, along with 3 new apps…', body: 'Welcome to HorizonOS.\n\nWe have added a Music Player, Mail and Calendar. Everything now goes somewhere. Try the Nebula Browser, too.\n\n— HorizonOS Team', time: '09:12', unread: true, starred: true },
  { id: 'm2', from: 'Nebula Prime', subject: 'Server maintenance tonight', preview: 'Scheduled downtime 02:00–04:00 server time…', body: 'All Nebula Prime lobbies will be briefly offline tonight for a city-block rebuild.\n\nThe suburbs, docks and towers are expanding. Existing builds remain intact.\n\n— Nebula Prime', time: '08:40', unread: true },
  { id: 'm3', from: 'The Humorous', subject: 'New dimension alert', preview: 'A Pun Overlord has been sighted near the spires…', body: 'A proper boss has wandered into The Humorous: the Pun Overlord.\n\nIt drops Chorus Shards and tells terrible jokes while it fights. Bring ear protection.\n\n— Isle Wardens', time: 'Yesterday', unread: false },
  { id: 'm4', from: 'Onblockaway Studio', subject: 'Build 39 shipped', preview: 'HorizonOS is now a real OS with draggable windows…', body: 'Batch 39 is live:\n\n• Draggable windows, Wi-Fi tray, File Explorer\n• Game Hub (Arena Shooter, Memory Cards)\n• Nebula Browser + extensions\n• Real audio-driven lipsync for the Cosmic Girl\n\n— ONEBLOCKAWAY STUDIO', time: 'Yesterday', unread: false },
  { id: 'm5', from: 'Giggle Records', subject: 'The Humorous Jingle is a hit', preview: '1,204 listens this week on the HorizonOS Music Player…', body: 'Your fans keep requesting The Humorous Jingle. Consider a longer cut.\n\n— Giggle Records', time: 'Mon', unread: false },
];

export default function MailApp() {
  const [messages, setMessages] = useState<MailMessage[]>(INITIAL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'inbox' | 'compose'>('inbox');
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const open = (id: string) => {
    setSelectedId(id);
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  };

  const send = () => {
    const newMsg: MailMessage = {
      id: 'sent:' + Date.now(),
      from: 'You',
      subject: compose.subject || '(no subject)',
      preview: compose.body.slice(0, 60),
      body: compose.body,
      time: 'now',
      unread: false,
      starred: false,
    };
    setMessages((ms) => [newMsg, ...ms]);
    setView('inbox');
    setSelectedId(newMsg.id);
    setCompose({ to: '', subject: '', body: '' });
  };

  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <div className="mail-app">
      <div className="mail-sidebar">
        <button className="mail-nav active" onClick={() => setView('inbox')}>📥 Inbox ({unreadCount})</button>
        <button className="mail-nav" onClick={() => setView('compose')}>✏️ Compose</button>
      </div>

      <div className="mail-body">
        {view === 'inbox' ? (
          <div className="mail-layout">
            <div className="mail-list">
              {messages.map((m) => (
                <button key={m.id} className={`mail-row ${selectedId === m.id ? 'sel' : ''} ${m.unread ? 'unread' : ''}`} onClick={() => open(m.id)}>
                  <span className="mail-from">{m.from}</span>
                  <span className="mail-subj">{m.subject}</span>
                  <span className="mail-preview">{m.preview}</span>
                  <span className="mail-time">{m.starred ? '★ ' : ''}{m.time}</span>
                </button>
              ))}
            </div>
            <div className="mail-read">
              {selected ? (
                <>
                  <h3 className="mail-read-subj">{selected.subject}</h3>
                  <div className="mail-read-meta">From: <b>{selected.from}</b> • {selected.time}</div>
                  <pre className="mail-read-body">{selected.body}</pre>
                </>
              ) : (
                <p className="mail-empty">Select a message to read it.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mail-compose">
            <label>To</label>
            <input value={compose.to} placeholder="recipient@horizonos.eaoin" onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
            <label>Subject</label>
            <input value={compose.subject} placeholder="Subject" onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
            <label>Message</label>
            <textarea value={compose.body} placeholder="Write your message…" rows={8} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
            <div className="mail-compose-actions">
              <button className="mp-btn" onClick={send}>📤 Send</button>
              <button className="mp-btn" onClick={() => setView('inbox')}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
