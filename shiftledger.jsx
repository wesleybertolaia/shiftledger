import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { read, save, today } from './storage.js';

const key = 'shiftledger-v1';
const employees = ['James Carter', 'Sophia Bennett', 'Noah Thompson'];
const seed = employees.map((employee, index) => ({
  id: 'shift-' + index, employee, date: today(), start: '09:00', end: index === 2 ? '17:30' : '17:00', breakMinutes: 0,
}));
const minutes = (time) => {
  const [hours, rest] = time.split(':').map(Number);
  return hours * 60 + rest;
};
const duration = (shift) => minutes(shift.end) - minutes(shift.start) - Number(shift.breakMinutes);
const format = (value) => Math.floor(value / 60) + 'h ' + value % 60 + 'm';

function ShiftLedger() {
  const [entries, setEntries] = useState(() => read(key, seed));
  const [role, setRole] = useState('employee');
  const [employee, setEmployee] = useState(employees[0]);
  const [filter, setFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(null);
  const visible = entries.filter((entry) => role === 'employee'
    ? entry.employee === employee
    : (!filter || entry.employee === filter) && (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));
  const total = visible.reduce((sum, entry) => sum + duration(entry), 0);
  const hasLoggedShift = entries.some((entry) => entry.employee === employee && !entry.id.startsWith('shift-'));

  const breakdown = employees.map((name) => ({
    name,
    minutes: visible.filter((entry) => entry.employee === name).reduce((sum, entry) => sum + duration(entry), 0),
  })).filter((item) => item.minutes > 0);
  const longest = Math.max(1, ...breakdown.map((item) => item.minutes));

  function previewShift(form) {
    const { start, end, breakMinutes } = form.elements;
    const net = start.value && end.value && breakMinutes.validity.valid
      ? duration({ start: start.value, end: end.value, breakMinutes: breakMinutes.value })
      : null;
    setDraft(net);
  }

  function fillExample(event) {
    const { elements } = event.currentTarget.form;
    elements.start.value = '18:00';
    elements.end.value = '20:00';
    elements.breakMinutes.value = '30';
    previewShift(event.currentTarget.form);
    elements.start.focus();
  }

  function logShift(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const entry = { ...Object.fromEntries(new FormData(form)), employee, id: crypto.randomUUID() };
    if (duration(entry) <= 0) {
      setNotice('End time must be after start time, and the break must be shorter than the shift. Split overnight shifts at midnight.');
      return;
    }
    if (entries.some((item) => item.employee === employee && item.date === entry.date && item.start < entry.end && entry.start < item.end)) {
      setNotice('This shift overlaps an existing entry.');
      return;
    }
    const next = [...entries, entry];
    if (!save(key, next)) {
      setNotice('Changes could not be saved in this browser.');
      return;
    }
    setEntries(next);
    setNotice('Shift logged.');
    form.reset();
    setDraft(null);
  }

  return <>
    <div className="switcher" aria-label="Demo role">
      {['employee', 'manager'].map((mode) => <button key={mode} type="button" aria-pressed={role === mode}
        onClick={() => { setRole(mode); setNotice(''); setDraft(null); }}>{mode === 'employee' ? 'Employee view' : 'Manager view'}</button>)}
    </div>
    <div className="mode-panel" key={role}>
    {role === 'employee' ? <>
            <h3>{hasLoggedShift ? 'Log a shift' : 'Log your first shift'}</h3>
      {!hasLoggedShift && <p className="onboarding-note">Enter your start, end, and unpaid break. You can load an example and check it before saving.</p>}
      <form onSubmit={logShift} onInput={(event) => previewShift(event.currentTarget)}>
        <label>Employee<select aria-label="Employee" value={employee} onChange={(event) => { setEmployee(event.target.value); setNotice(''); }}>
          {employees.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        <label>Date<input type="date" name="date" defaultValue={today()} required /></label>
        <label>Start time<input type="time" name="start" required /></label>
        <label>End time<input type="time" name="end" required /></label>
        <label>Break (minutes)<input type="number" name="breakMinutes" min="0" max="1439" step="1" defaultValue="0" required /></label>
                <button type="submit">Log shift</button>
        {!hasLoggedShift && <button className="secondary" type="button" onClick={fillExample}>Use example hours</button>}
      </form>
      <p className="net-preview" aria-live="polite">
        <span>Net time</span>
        <strong>{draft === null ? 'Enter shift times' : draft > 0 ? format(draft) : 'Check shift and break'}</strong>
      </p>
    </> : <>
      <h3>Team work hours</h3>
      <div className="filters">
        <label>Employee<select aria-label="Employee" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All employees</option>{employees.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        <label>From<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="secondary" type="button" onClick={() => { setFilter(''); setFrom(''); setTo(''); }}>Clear filters</button>
      </div>
    </>}
    </div>
    <p className="notice" role="status">{notice}</p>
    <div className="summary"><strong>Total work hours</strong><strong key={total}>{format(total)}</strong></div>
    {role === 'manager' && breakdown.length > 0 && <ul className="breakdown" aria-label="Work hours by employee">
      {breakdown.map(({name, minutes}) => <li key={name}>
        <span>{name}</span><span className="bar" aria-hidden="true"><i style={{width: (minutes / longest * 100) + '%'}}></i></span><strong>{format(minutes)}</strong>
      </li>)}
    </ul>}
    <div className="table-wrap" tabIndex="0" aria-label="Work hours"><table>
      <thead><tr><th>Employee</th><th>Date</th><th>Start</th><th>End</th><th>Break</th><th>Worked</th></tr></thead>
      <tbody>{visible.length ? visible.map((entry) => <tr key={entry.id}>
        <td>{entry.employee}</td><td>{entry.date}</td><td>{entry.start}</td><td>{entry.end}</td>
        <td>{entry.breakMinutes} min</td><td>{format(duration(entry))}</td>
      </tr>) : <tr><td colSpan="6">No shifts match these filters.</td></tr>}</tbody>
    </table></div>
  </>;
}

export function mount(container) {
  const root = createRoot(container);
  root.render(<ShiftLedger />);
  const observer = new MutationObserver(() => {
    if (!container.isConnected) {
      observer.disconnect();
      root.unmount();
    }
  });
  observer.observe(document.querySelector('#demo'), { childList: true });
}
