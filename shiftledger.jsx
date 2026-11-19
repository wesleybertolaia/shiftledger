import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { read, save, today } from './storage.js';

const { t, date: displayDate } = window.siteLocale;
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
  const visible = entries.filter((entry) => role === 'employee'
    ? entry.employee === employee
    : (!filter || entry.employee === filter) && (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));
  const total = visible.reduce((sum, entry) => sum + duration(entry), 0);
  const hasLoggedShift = entries.some((entry) => entry.employee === employee && !entry.id.startsWith('shift-'));

  function fillExample(event) {
    const { elements } = event.currentTarget.form;
    elements.start.value = '18:00';
    elements.end.value = '20:00';
    elements.breakMinutes.value = '30';
    elements.start.focus();
  }

  function logShift(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const entry = { ...Object.fromEntries(new FormData(form)), employee, id: crypto.randomUUID() };
    if (duration(entry) <= 0) {
      setNotice(t('End time must be after start time, and the break must be shorter than the shift. Split overnight shifts at midnight.'));
      return;
    }
    if (entries.some((item) => item.employee === employee && item.date === entry.date && item.start < entry.end && entry.start < item.end)) {
      setNotice(t('This shift overlaps an existing entry.'));
      return;
    }
    const next = [...entries, entry];
    if (!save(key, next)) {
      setNotice(t('Changes could not be saved in this browser.'));
      return;
    }
    setEntries(next);
    setNotice(t('Shift logged.'));
    form.reset();
  }

  return <>
    <div className="switcher" aria-label={t("Demo role")}>
      {['employee', 'manager'].map((mode) => <button key={mode} type="button" aria-pressed={role === mode}
        onClick={() => { setRole(mode); setNotice(''); }}>{mode === 'employee' ? t('Employee view') : t('Manager view')}</button>)}
    </div>
    <div className="mode-panel" key={role}>
    {role === 'employee' ? <>
            <h3>{hasLoggedShift ? t('Log a shift') : t('Log your first shift')}</h3>
      {!hasLoggedShift && <p className="onboarding-note">{t("Enter your start, end, and unpaid break. You can load an example and check it before saving.")}</p>}
      <form onSubmit={logShift}>
        <label>{t("Employee")}<select aria-label={t("Employee")} value={employee} onChange={(event) => { setEmployee(event.target.value); setNotice(''); }}>
          {employees.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        <label>{t("Date")}<input type="date" name="date" defaultValue={today()} required /></label>
        <label>{t("Start time")}<input type="time" name="start" required /></label>
        <label>{t("End time")}<input type="time" name="end" required /></label>
        <label>{t("Break (minutes)")}<input type="number" name="breakMinutes" min="0" max="1439" step="1" defaultValue="0" required /></label>
                <button type="submit">{t("Log shift")}</button>
        {!hasLoggedShift && <button className="secondary" type="button" onClick={fillExample}>{t("Use example hours")}</button>}
      </form>
    </> : <>
      <h3>{t("Team work hours")}</h3>
      <div className="filters">
        <label>{t("Employee")}<select aria-label={t("Employee")} value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">{t("All employees")}</option>{employees.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        <label>{t("From")}<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>{t("To")}<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="secondary" type="button" onClick={() => { setFilter(''); setFrom(''); setTo(''); }}>{t("Clear filters")}</button>
      </div>
    </>}
    </div>
    <p className="notice" role="status">{notice}</p>
    <div className="summary"><strong>{t("Total work hours")}</strong><strong key={total}>{format(total)}</strong></div>
    <div className="table-wrap" tabIndex="0" aria-label={t("Work hours")}><table>
      <thead><tr><th>{t("Employee")}</th><th>{t("Date")}</th><th>{t("Start")}</th><th>{t("End")}</th><th>{t("Break")}</th><th>{t("Worked")}</th></tr></thead>
      <tbody>{visible.length ? visible.map((entry) => <tr key={entry.id}>
        <td>{entry.employee}</td><td>{displayDate(entry.date)}</td><td>{entry.start}</td><td>{entry.end}</td>
        <td>{entry.breakMinutes} min</td><td>{format(duration(entry))}</td>
      </tr>) : <tr><td colSpan="6">{t("No shifts match these filters.")}</td></tr>}</tbody>
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
