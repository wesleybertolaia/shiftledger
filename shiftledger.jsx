import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { read, save, today } from './storage.js';

const { t, date: displayDate, language } = window.siteLocale;
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

function addDays(iso, count) {
  const day = new Date(iso);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
}

function weekStart(iso) {
  return addDays(iso, -((new Date(iso).getUTCDay() + 6) % 7));
}

const shortDay = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' });

function ShiftLedger() {
  const [entries, setEntries] = useState(() => read(key, seed));
  const [role, setRole] = useState('employee');
  const [employee, setEmployee] = useState(employees[0]);
  const [filter, setFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [reviewId, setReviewId] = useState(null);
  const [reviewReason, setReviewReason] = useState('');
  const [week, setWeek] = useState(() => weekStart(today()));
  const [selectedDay, setSelectedDay] = useState('');
  const visible = entries.filter((entry) => role === 'employee'
    ? entry.employee === employee
    : (!filter || entry.employee === filter) && (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));
  const minutesByDay = new Map();
  for (const entry of visible) {
    minutesByDay.set(entry.date, (minutesByDay.get(entry.date) || 0) + duration(entry));
  }
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week, index);
    return [date, minutesByDay.get(date) || 0];
  });
  const weeklyTotal = activity.reduce((sum, [, worked]) => sum + worked, 0);
  const displayed = selectedDay ? visible.filter(entry => entry.date === selectedDay) : visible;
  function changeWeek(offset) {
    setWeek(addDays(week, offset));
    setSelectedDay('');
  }
  const activityMax = Math.max(1, ...activity.map(([, minutes]) => minutes));
  const approved = visible.filter(entry => !entry.status || entry.status === 'Approved');
  const approvedTotal = approved.reduce((sum, entry) => sum + duration(entry), 0);

  function exportApproved() {
    const columns = ['Employee', 'Date', 'Start', 'End', 'Break minutes', 'Approved minutes'];
    const rows = approved.map(entry => [
      entry.employee, entry.date, entry.start, entry.end, entry.breakMinutes, duration(entry),
    ]);
    const csv = [columns.map(t), ...rows].map(row =>
      row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')
    ).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shiftledger-approved-hours.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(t('Approved hours exported.'));
  }

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
    const entry = { ...Object.fromEntries(new FormData(form)), employee, id: correction?.id || crypto.randomUUID() };
    if (duration(entry) <= 0) {
      setNotice(t('End time must be after start time, and the break must be shorter than the shift. Split overnight shifts at midnight.'));
      return;
    }
    if (entries.some((item) => item.id !== entry.id && item.employee === employee && item.date === entry.date && item.start < entry.end && entry.start < item.end)) {
      setNotice(t('This shift overlaps an existing entry.'));
      return;
    }
    setDraft({ ...entry, status: 'Pending review' });
    setNotice('');
  }

  function submitShift() {
    const next = correction ? entries.map(entry => entry.id === draft.id ? draft : entry) : [...entries, draft];
    if (!save(key, next)) {
      setNotice(t('Changes could not be saved in this browser.'));
      return;
    }
    setEntries(next);
    setWeek(weekStart(draft.date));
    setSelectedDay(draft.date);
    setNotice(t('Shift submitted for review.'));
    setDraft(null);
    setCorrection(null);
  }

  function reviewShift(id, status, reason = '') {
    const next = entries.map(entry => entry.id === id && entry.status === 'Pending review' ? { ...entry, status, reviewReason: reason } : entry);
    if (!save(key, next)) {
      setNotice(t('Changes could not be saved in this browser.'));
      return;
    }
    setEntries(next);
    setReviewId(null);
    setReviewReason('');
    setNotice(t('Review saved.'));
  }

  const headerTotal = document.querySelector('#shift-hero-total');
  return <>
    {headerTotal && createPortal(<section className="hours-activity" aria-labelledby="activity-title">
      <div className="week-header">
        <div><h3 id="activity-title">{t('Hours by day')}</h3><p>{displayDate(week)} – {displayDate(addDays(week, 6))}</p></div>
        <div className="week-nav">
          <button type="button" aria-label={t('Previous week')} onClick={() => changeWeek(-7)}>‹</button>
          <button type="button" aria-label={t('Next week')} onClick={() => changeWeek(7)}>›</button>
        </div>
      </div>
      <div className="week-days" key={week}>
        {activity.map(([day, worked], index) => <button type="button" key={day} className="week-day"
          aria-label={displayDate(day) + ' · ' + format(worked)} aria-pressed={selectedDay === day}
          onClick={() => setSelectedDay(selectedDay === day ? '' : day)}>
          <span className="day-track" aria-hidden="true"><span style={{ '--worked': worked / activityMax, '--day-order': index }} /></span>
          <span>{shortDay.format(new Date(day))}</span><strong>{worked ? format(worked) : '—'}</strong>
        </button>)}
      </div>
      <p className="week-total"><span>{t('Week total')}</span><strong key={weeklyTotal}>{format(weeklyTotal)}</strong></p>
    </section>, headerTotal)}
    <div className="work-toolbar">
      <div className="switcher" aria-label={t("Workspace view")}>
        {['employee', 'manager'].map((mode) => <button key={mode} type="button" aria-pressed={role === mode}
          onClick={() => {
            if (mode === role) return;
            setRole(mode);
            setSelectedDay('');
            setNotice('');
            setDraft(null);
            setCorrection(null);
            setReviewId(null);
            setReviewReason('');
          }}>{mode === 'employee' ? t('Employee view') : t('Manager view')}</button>)}
      </div>
      <p className="help">{t('Changes stay on this device. The workspace starts with sample shifts.')}</p>
    </div>
    <p className="notice" role="status">{notice}</p>
    <div className="timesheet-workspace" data-role={role}>
    <div className="timesheet-records" key={role}>
      <div className="record-header">
        <h3>{selectedDay ? displayDate(selectedDay) : t('Work hours')}</h3>
        {selectedDay && <button type="button" className="secondary" onClick={() => setSelectedDay('')}>{t('Show all shifts')}</button>}
      </div>
      {role === 'manager' && <div className="review-summary">
        <div><strong>{visible.filter(entry => entry.status === 'Pending review').length}</strong><span>{t('Awaiting review')}</span></div>
        <div><strong>{format(approvedTotal)}</strong><span>{t('Approved hours')}</span></div>
        <button className="secondary" type="button" disabled={!approved.length} onClick={exportApproved}>{t('Export approved hours')}</button>
      </div>}
      {role === 'manager' && <div className="filters">
        <label>{t("Employee")}<select aria-label={t("Employee")} value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">{t("All employees")}</option>{employees.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        <label>{t("From")}<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>{t("To")}<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="secondary" type="button" onClick={() => { setFilter(''); setFrom(''); setTo(''); }}>{t("Clear filters")}</button>
      </div>}
    <div className="table-wrap" tabIndex="0" aria-label={t("Work hours")}><table role="table">
      <thead role="rowgroup"><tr role="row"><th scope="col">{t("Employee")}</th><th scope="col">{t("Date")}</th><th scope="col">{t("Shift")}</th><th scope="col">{t("Worked")}</th><th scope="col">{t("Review status")}</th></tr></thead>
      <tbody role="rowgroup">{displayed.length ? displayed.map((entry) => <tr key={entry.id} role="row">
        <td role="cell">{entry.employee}</td><td role="cell">{displayDate(entry.date)}</td><td role="cell">{entry.start}–{entry.end}<small>{t("Break")} · {entry.breakMinutes} min</small></td><td role="cell">{format(duration(entry))}</td>
        <td role="cell"><span className="shift-status">{t(entry.status || 'Approved')}</span>
          {entry.reviewReason && <p className="review-reason">{t(entry.reviewReason)}</p>}
          {role === 'employee' && entry.status === 'Needs correction' && <div className="review-actions">
            <button type="button" onClick={() => { setCorrection(entry); setDraft(null); document.querySelector('.mode-panel')?.scrollIntoView({ block: 'nearest' }); }}>{t('Fix entry')}</button>
          </div>}
          {role === 'manager' && entry.status === 'Pending review' && <div className="review-actions">
            <button type="button" onClick={() => reviewShift(entry.id, 'Approved')}>{t('Approve')}</button>
            <button className="secondary" type="button" onClick={() => { setReviewId(entry.id); setReviewReason(''); }}>{t('Request correction')}</button>
            {reviewId === entry.id && <form className="reason-form" onSubmit={event => {
              event.preventDefault();
              if (reviewReason) reviewShift(entry.id, 'Needs correction', reviewReason);
            }}>
              <label>{t('What needs fixing?')}
                <select required value={reviewReason} onChange={event => setReviewReason(event.target.value)}>
                  <option value="">{t('Choose a reason')}</option>
                  {['Check the start and end times', 'Check the unpaid break', 'Check the shift date'].map(reason =>
                    <option key={reason} value={reason}>{t(reason)}</option>)}
                </select>
              </label>
              <button type="submit">{t('Return shift with reason')}</button>
            </form>}
          </div>}
        </td>
      </tr>) : <tr className="empty-row" role="row"><td role="cell" colSpan="5">{t("No shifts match these filters.")}</td></tr>}</tbody>
    </table></div>
    </div>
    {role === 'employee' && <div className="mode-panel">
      <div className="mode-heading">
        <h3>{hasLoggedShift ? t('Log a shift') : t('Log your first shift')}</h3>
        {!hasLoggedShift && <button className="secondary example-button" type="button" form="shift-entry" onClick={fillExample}>{t('Use example hours')}</button>}
      </div>
      {!hasLoggedShift && <p className="onboarding-note">{t("Enter your start, end, and unpaid break. You can load an example and check it before saving.")}</p>}
      <form id="shift-entry" key={correction?.id || entries.length} onSubmit={logShift}>
        <label>{t("Employee")}<select aria-label={t("Employee")} value={employee} onChange={(event) => { setEmployee(event.target.value); setNotice(''); setCorrection(null); setDraft(null); }}>
          {employees.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        <label>{t("Date")}<input type="date" name="date" defaultValue={correction?.date || today()} required /></label>
        <label>{t("Start time")}<input type="time" name="start" defaultValue={correction?.start} required /></label>
        <label>{t("End time")}<input type="time" name="end" defaultValue={correction?.end} required /></label>
        <label>{t("Break (minutes)")}<input type="number" name="breakMinutes" min="0" max="1439" step="1" defaultValue={correction?.breakMinutes ?? 0} required /></label>
                <button type="submit">{t("Review shift")}</button>
      </form>
      {draft && <section className="shift-review">
        <h4>{t('Ready to submit?')}</h4>
        <p>{draft.start}–{draft.end} · {draft.breakMinutes} min · <strong>{format(duration(draft))}</strong></p>
        <div className="review-actions">
          <button type="button" onClick={submitShift}>{t('Submit for review')}</button>
          <button className="secondary" type="button" onClick={() => setDraft(null)}>{t('Edit shift')}</button>
        </div>
      </section>}
    </div>}
    </div>
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
