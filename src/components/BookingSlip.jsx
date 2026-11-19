import { useId, useMemo, useState } from 'react';
import { Loader2, ArrowRight, X } from 'lucide-react';
import { LIMITS, LOCATIONS, SUGGESTED_SKILLS, TARGET_ROLES } from '../../shared/options.js';

/** Accessible autocomplete state: open flag, active index, keyboard handler. */
function useListbox(options, onPick) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault(); setOpen(true); setActive(i => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault(); setOpen(true); setActive(i => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false); setActive(-1);
    } else if (e.key === 'Enter' && open && active >= 0 && options[active]) {
      e.preventDefault(); onPick(options[active]); setActive(-1);
    }
  };
  return { open: open && options.length > 0, setOpen, active, setActive, onKeyDown };
}

export default function BookingSlip({ skills, setSkills, draft, setDraft, goal, setGoal, location, setLocation, onSubmit, loading }) {
  const ids = { skills: useId(), skillList: useId(), role: useId(), roleList: useId(), region: useId(), err: useId() };
  const [error, setError] = useState('');
  const full = skills.length >= LIMITS.maxSkills;

  const addSkill = (raw) => {
    const s = raw.trim().slice(0, LIMITS.maxSkillLength);
    if (!s || full) return;
    if (!skills.some(x => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s]);
    setDraft('');
    setError('');
  };

  const skillOptions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(skills.map(s => s.toLowerCase()));
    return SUGGESTED_SKILLS.filter(s => s.toLowerCase().includes(q) && !taken.has(s.toLowerCase())).slice(0, 7);
  }, [draft, skills]);
  const skillBox = useListbox(skillOptions, addSkill);

  const roleOptions = useMemo(() => {
    const q = goal.trim().toLowerCase();
    return TARGET_ROLES.filter(r => !q || (r.toLowerCase().includes(q) && r.toLowerCase() !== q)).slice(0, 7);
  }, [goal]);
  const roleBox = useListbox(roleOptions, (r) => { setGoal(r); roleBox.setOpen(false); });

  const onSkillKey = (e) => {
    skillBox.onKeyDown(e);
    if (e.defaultPrevented) return;
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); addSkill(draft); }
    else if (e.key === 'Backspace' && !draft && skills.length) setSkills(skills.slice(0, -1));
  };
  const onSkillChange = (e) => {
    const v = e.target.value;
    if (v.includes(',')) {
      const parts = v.split(',');
      const next = [...skills];
      for (const p of parts.slice(0, -1)) {
        const s = p.trim().slice(0, LIMITS.maxSkillLength);
        if (s && next.length < LIMITS.maxSkills && !next.some(x => x.toLowerCase() === s.toLowerCase())) next.push(s);
      }
      setSkills(next);
      setDraft(parts.at(-1).trimStart());
    } else {
      setDraft(v);
    }
    skillBox.setOpen(true); skillBox.setActive(-1); setError('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!skills.length && !draft.trim()) { setError('Add at least one skill you already have.'); return; }
    onSubmit();
  };

  return (
    <form className="sheet slip" onSubmit={submit} noValidate aria-label="Plan your route">
      <div className="slip-head">
        <span>Route planning slip</span>
        <span className="num">{skills.length}/{LIMITS.maxSkills} skills</span>
      </div>
      <div className="slip-body">
        <div className="field field-from">
          <label className="field-label" htmlFor={ids.skills}>From · your skills</label>
          <div className="control chips-control" onClick={() => document.getElementById(ids.skills)?.focus()}>
            {skills.map(s => (
              <span className="chip" key={s}>
                {s}
                <button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills(skills.filter(x => x !== s))}><X size={13} /></button>
              </span>
            ))}
            <input
              id={ids.skills}
              value={draft}
              onChange={onSkillChange}
              onKeyDown={onSkillKey}
              onFocus={() => skillBox.setOpen(true)}
              onBlur={() => setTimeout(() => skillBox.setOpen(false), 120)}
              placeholder={skills.length ? (full ? 'Skill limit reached' : 'Add another…') : 'Type a skill, e.g. Python'}
              disabled={full}
              maxLength={LIMITS.maxSkillLength}
              autoComplete="off"
              role="combobox"
              aria-label="Current skills"
              aria-autocomplete="list"
              aria-expanded={skillBox.open}
              aria-controls={ids.skillList}
              aria-activedescendant={skillBox.active >= 0 ? `${ids.skillList}-${skillBox.active}` : undefined}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? ids.err : undefined}
            />
          </div>
          {skillBox.open && (
            <ul className="listbox" id={ids.skillList} role="listbox" aria-label="Suggested skills">
              {skillOptions.map((s, i) => (
                <li key={s} id={`${ids.skillList}-${i}`} role="option" aria-selected={i === skillBox.active}
                  onMouseDown={(e) => { e.preventDefault(); addSkill(s); }}>
                  {s}
                </li>
              ))}
            </ul>
          )}
          {error
            ? <span className="field-hint field-error" id={ids.err} role="alert">{error}</span>
            : <span className="field-hint">Press Enter or comma after each skill.</span>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={ids.role}>To · target role</label>
          <input
            id={ids.role}
            className="control"
            value={goal}
            onChange={e => { setGoal(e.target.value); roleBox.setOpen(true); roleBox.setActive(-1); }}
            onKeyDown={roleBox.onKeyDown}
            onFocus={() => roleBox.setOpen(true)}
            onBlur={() => setTimeout(() => roleBox.setOpen(false), 120)}
            placeholder="e.g. Backend Engineer"
            maxLength={LIMITS.maxCustomGoalLength}
            autoComplete="off"
            role="combobox"
            aria-label="Target role"
            aria-autocomplete="list"
            aria-expanded={roleBox.open}
            aria-controls={ids.roleList}
            aria-activedescendant={roleBox.active >= 0 ? `${ids.roleList}-${roleBox.active}` : undefined}
          />
          {roleBox.open && (
            <ul className="listbox" id={ids.roleList} role="listbox" aria-label="Suggested roles">
              {roleOptions.map((r, i) => (
                <li key={r} id={`${ids.roleList}-${i}`} role="option" aria-selected={i === roleBox.active}
                  onMouseDown={(e) => { e.preventDefault(); setGoal(r); roleBox.setOpen(false); }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
          <span className="field-hint">Optional. Needed for real-posting data.</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={ids.region}>Region</label>
          <select id={ids.region} className="control" value={location} onChange={e => setLocation(e.target.value)}>
            {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label.replace(/^\S+\s/, '')}</option>)}
          </select>
          <span className="field-hint spacer" aria-hidden="true">&nbsp;</span>
        </div>

        <div className="field field-submit">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
            {loading ? 'Planning…' : 'Plan my route'}
          </button>
          <span className="field-hint spacer" aria-hidden="true">&nbsp;</span>
        </div>
      </div>
    </form>
  );
}
