import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, ArrowRight, X } from 'lucide-react';
import { LIMITS, LOCATIONS, SUGGESTED_SKILLS, TARGET_ROLES } from '../../shared/options.js';

const BLUR_CLOSE_MS = 120; // lets a click on an option land before the list closes

/**
 * Accessible combobox state (WAI-ARIA 1.2 list autocomplete): open flag,
 * active option, keyboard handler and focus/blur handlers whose close timer
 * is cleared on refocus and unmount.
 */
function useListbox(options, onPick) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef(null);
  const optionsKey = options.join('\u0000');

  const cancelClose = () => { clearTimeout(timer.current); timer.current = null; };
  useEffect(() => cancelClose, []);
  // A new option list invalidates the highlighted index.
  useEffect(() => { setActive(-1); }, [optionsKey]);

  const close = useCallback(() => { cancelClose(); setOpen(false); setActive(-1); }, []);
  const expanded = open && options.length > 0;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault(); setOpen(true); setActive(i => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault(); setOpen(true); setActive(i => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault(); close();
    } else if (e.key === 'Enter' && expanded && active >= 0 && options[active]) {
      e.preventDefault(); onPick(options[active]); setActive(-1);
    }
  };

  return {
    expanded,
    active: expanded && active < options.length ? active : -1,
    open: () => { cancelClose(); setOpen(true); },
    close,
    onFocus: () => { cancelClose(); setOpen(true); },
    onBlur: () => { cancelClose(); timer.current = setTimeout(close, BLUR_CLOSE_MS); },
    onKeyDown,
  };
}

/** The listbox stays mounted so aria-controls always points at a real element. */
function Listbox({ id, label, options, box, onPick }) {
  return (
    <ul className="listbox" id={id} role="listbox" aria-label={label} hidden={!box.expanded}>
      {options.map((o, i) => (
        <li key={o} id={`${id}-${i}`} role="option" aria-selected={i === box.active}
          onMouseDown={(e) => { e.preventDefault(); onPick(o); }}>
          {o}
        </li>
      ))}
    </ul>
  );
}

const countLabel = (n, noun) => (n ? `${n} ${noun}${n === 1 ? '' : 's'} available. Use up and down arrows to choose.` : '');

const addUnique = (list, raw) => {
  const s = raw.trim().slice(0, LIMITS.maxSkillLength);
  if (!s || list.length >= LIMITS.maxSkills || list.some(x => x.toLowerCase() === s.toLowerCase())) return list;
  return [...list, s];
};

export default function BookingSlip({ skills, setSkills, draft, setDraft, goal, setGoal, location, setLocation, onSubmit, loading }) {
  const ids = {
    skills: useId(), skillList: useId(), skillHint: useId(), skillStatus: useId(),
    role: useId(), roleList: useId(), roleHint: useId(), region: useId(), err: useId(),
  };
  const skillInput = useRef(null);
  const [error, setError] = useState('');
  const full = skills.length >= LIMITS.maxSkills;

  const addSkill = (raw) => {
    if (full) return;
    setSkills(prev => addUnique(prev, raw));
    setDraft('');
    setError('');
  };

  const removeSkill = (s) => {
    setSkills(prev => prev.filter(x => x !== s));
    skillInput.current?.focus(); // the button that had focus is about to disappear
  };

  const skillOptions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(skills.map(s => s.toLowerCase()));
    return SUGGESTED_SKILLS.filter(s => s.toLowerCase().includes(q) && !taken.has(s.toLowerCase())).slice(0, 7);
  }, [draft, skills]);
  const skillBox = useListbox(full ? [] : skillOptions, addSkill);

  const roleOptions = useMemo(() => {
    const q = goal.trim().toLowerCase();
    return TARGET_ROLES.filter(r => !q || (r.toLowerCase().includes(q) && r.toLowerCase() !== q)).slice(0, 7);
  }, [goal]);
  const pickRole = (r) => { setGoal(r); roleBox.close(); };
  const roleBox = useListbox(roleOptions, pickRole);

  const onSkillKey = (e) => {
    skillBox.onKeyDown(e);
    if (e.defaultPrevented || full) return;
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); addSkill(draft); }
    else if (e.key === 'Backspace' && !draft && skills.length) setSkills(prev => prev.slice(0, -1));
  };

  const onSkillChange = (e) => {
    if (full) return;
    const v = e.target.value;
    if (v.includes(',')) {
      const parts = v.split(',');
      setSkills(prev => parts.slice(0, -1).reduce(addUnique, prev));
      setDraft(parts.at(-1).trimStart());
    } else {
      setDraft(v);
    }
    skillBox.open();
    setError('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!skills.length && !draft.trim()) {
      setError('Add at least one skill you already have.');
      skillInput.current?.focus();
      return;
    }
    onSubmit();
  };

  const skillHint = full
    ? `Limit of ${LIMITS.maxSkills} skills reached. Remove one to add another.`
    : 'Press Enter or comma after each skill.';

  return (
    <form className="sheet slip" onSubmit={submit} noValidate aria-label="Plan your route">
      <div className="slip-head">
        <span>Route planning slip</span>
        <span className="num">{skills.length}/{LIMITS.maxSkills} skills</span>
      </div>
      <div className="slip-body">
        <div className="field field-from">
          <label className="field-label" htmlFor={ids.skills}>From · your skills</label>
          <div className="control chips-control" onClick={() => skillInput.current?.focus()}>
            {skills.map(s => (
              <span className="chip" key={s}>
                {s}
                <button type="button" aria-label={`Remove ${s}`} onClick={(e) => { e.stopPropagation(); removeSkill(s); }}>
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              ref={skillInput}
              id={ids.skills}
              value={draft}
              onChange={onSkillChange}
              onKeyDown={onSkillKey}
              onFocus={skillBox.onFocus}
              onBlur={skillBox.onBlur}
              placeholder={skills.length ? (full ? 'Skill limit reached' : 'Add another…') : 'Type a skill, e.g. Python'}
              readOnly={full}
              aria-disabled={full || undefined}
              maxLength={LIMITS.maxSkillLength}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={skillBox.expanded}
              aria-controls={ids.skillList}
              aria-activedescendant={skillBox.active >= 0 ? `${ids.skillList}-${skillBox.active}` : undefined}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${ids.err} ${ids.skillHint}` : ids.skillHint}
            />
          </div>
          <Listbox id={ids.skillList} label="Suggested skills" options={full ? [] : skillOptions} box={skillBox} onPick={addSkill} />
          {error && <span className="field-hint field-error" id={ids.err} role="alert">{error}</span>}
          <span className="field-hint" id={ids.skillHint}>{skillHint}</span>
          <span className="sr-only" role="status" id={ids.skillStatus}>{skillBox.expanded ? countLabel(skillOptions.length, 'suggestion') : ''}</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={ids.role}>To · target role</label>
          <input
            id={ids.role}
            className="control"
            value={goal}
            onChange={e => { setGoal(e.target.value); roleBox.open(); }}
            onKeyDown={roleBox.onKeyDown}
            onFocus={roleBox.onFocus}
            onBlur={roleBox.onBlur}
            placeholder="e.g. Backend Engineer"
            maxLength={LIMITS.maxCustomGoalLength}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={roleBox.expanded}
            aria-controls={ids.roleList}
            aria-activedescendant={roleBox.active >= 0 ? `${ids.roleList}-${roleBox.active}` : undefined}
            aria-describedby={ids.roleHint}
          />
          <Listbox id={ids.roleList} label="Suggested roles" options={roleOptions} box={roleBox} onPick={pickRole} />
          <span className="field-hint" id={ids.roleHint}>Optional. Needed for real-posting data.</span>
          <span className="sr-only" role="status">{roleBox.expanded ? countLabel(roleOptions.length, 'role') : ''}</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={ids.region}>Region</label>
          <select id={ids.region} className="control" value={location} onChange={e => setLocation(e.target.value)}>
            {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label.replace(/^\S+\s/, '')}</option>)}
          </select>
          <span className="field-hint spacer" aria-hidden="true">&nbsp;</span>
        </div>

        <div className="field field-submit">
          <button type="submit" className="btn btn-primary" disabled={loading} aria-busy={loading || undefined}>
            {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
            {loading ? 'Planning…' : 'Plan my route'}
          </button>
          <span className="field-hint spacer" aria-hidden="true">&nbsp;</span>
        </div>
      </div>
    </form>
  );
}
