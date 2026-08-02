/**
 * HorizonOS Calendar — a working in-OS calendar.
 *
 * A month grid with world events (blood moon, Oris incursion, Humorous jingle
 * release, server maintenance). Click a day to see its events; add a simple
 * reminder.
 */
import { useMemo, useState } from 'react';

interface CalEvent {
  day: number;
  title: string;
  emoji: string;
}

const MONTH_EVENTS: CalEvent[] = [
  { day: 1, title: 'New month server reset', emoji: '🌐' },
  { day: 3, title: 'Blood Moon', emoji: '🌕' },
  { day: 7, title: 'Oris incursion', emoji: '🌀' },
  { day: 10, title: 'Crimson moon', emoji: '🔴' },
  { day: 14, title: 'Psychedelics moon', emoji: '🌈' },
  { day: 17, title: 'The Humorous jingle release', emoji: '🍄' },
  { day: 21, title: 'Nebula Prime maintenance', emoji: '🛠' },
  { day: 26, title: 'Full moon werewolf swarm', emoji: '🐺' },
  { day: 30, title: 'City-block expansion ships', emoji: '🏙' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarApp() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [custom, setCustom] = useState<CalEvent[]>([]);
  const [noteDay, setNoteDay] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const events = useMemo(() => [...MONTH_EVENTS, ...custom], [custom]);

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dayEvents = (day: number) => events.filter((e) => e.day === day);
  const today = now.getDate();

  const addNote = () => {
    if (noteDay == null || !noteText.trim()) return;
    setCustom((c) => [...c, { day: noteDay, title: noteText, emoji: '📌' }]);
    setNoteText('');
    setNoteDay(null);
  };

  return (
    <div className="calendar-app">
      <div className="cal-head">
        <button className="mp-btn" onClick={() => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); }}>◀</button>
        <strong className="cal-title">{MONTHS[month]} {year}</strong>
        <button className="mp-btn" onClick={() => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); }}>▶</button>
      </div>

      <div className="cal-week">
        {WEEKDAYS.map((d, i) => <span key={i} className="cal-wd">{d}</span>)}
      </div>

      <div className="cal-grid">
        {cells.map((day, i) => (
          <div key={i} className={`cal-cell ${day == null ? 'empty' : ''} ${day === today ? 'today' : ''} ${noteDay === day ? 'pick' : ''}`}
            onClick={() => day != null && setNoteDay(day)}>
            {day != null && <span className="cal-daynum">{day}</span>}
            <div className="cal-events">
              {day != null && dayEvents(day).map((e) => (
                <span key={e.title} className="cal-event" title={e.title}>{e.emoji} {e.title}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {noteDay != null && (
        <div className="cal-note">
          <span>Day {noteDay} reminder:</span>
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a reminder…" onKeyDown={(e) => e.key === 'Enter' && addNote()} />
          <button className="mp-btn" onClick={addNote}>Add</button>
          <button className="mp-btn" onClick={() => setNoteDay(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
