// Deterministic skill extraction from job-posting text, using the shared
// taxonomy. No LLM involved: every count shown to users is reproducible.

import { skillSurfaceForms } from '../../shared/skills.js';

// Forms that are ordinary English words (or substrings of them) in job ads.
// They are never matched on their own.
const SKIP_FORMS = new Set([
  'r', 'go', 'py', 'ts', 'dl', 'next', 'node', 'express', 'nest', 'shell', 'stats', 'compose',
  'monitoring', 'testing', 'rest', 'vue', 'spark',
]);

// Labels that collide with common words in lowercase; matched case-sensitively only.
const CASE_SENSITIVE = new Set(['Rust', 'Swift', 'Spark', 'Bun', 'Expo', 'Unity', 'Excel', 'RAG', 'Flutter', 'Angular', 'React', 'Kafka', 'Airflow']);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build a regex for one surface form: internal dots optional, spaces/hyphens interchangeable. */
function formPattern(form) {
  const lead = form.startsWith('.') ? '\\.' : '';
  const body = (lead ? form.slice(1) : form)
    .split('')
    .map((ch, i, arr) => {
      if (ch === '.' && i > 0 && i < arr.length - 1) return '\\.?';
      if (ch === ' ' || ch === '-') return '[\\s-]?';
      return escape(ch);
    })
    .join('');
  // Custom word boundary: skill names contain + # . / which \b does not handle.
  // A preceding "." is excluded too, so "js" in "Node.js" is not read as JavaScript.
  return lead ? `(?<![A-Za-z0-9+#])${lead}${body}(?![A-Za-z0-9+#])` : `(?<![A-Za-z0-9+#.])${body}(?![A-Za-z0-9+#])`;
}

const MATCHERS = skillSurfaceForms().flatMap(({ label, forms }) => {
  const out = [];
  if (CASE_SENSITIVE.has(label)) out.push(new RegExp(formPattern(label)));
  const insensitive = forms.filter(f => !SKIP_FORMS.has(f.toLowerCase()) && !(CASE_SENSITIVE.has(label) && f === label));
  if (insensitive.length) out.push(new RegExp(insensitive.map(formPattern).join('|'), 'i'));
  // Extra explicit forms for skipped short names.
  // "Go" only when it reads as a list item: "Python, Go", "(Go)", "Go/Rust".
  if (label === 'Go') out.push(/(?<=[,(/]\s?)Go(?![A-Za-z0-9])|(?<![A-Za-z0-9])Go(?=\s?[,/)])/);
  if (label === 'Apache Spark') out.push(/(?<![A-Za-z0-9])Spark(?= ?(?:SQL|Streaming|[,/)]))|(?<=[,(/]\s?)Spark(?![A-Za-z0-9])/);
  if (label === 'Vue.js') out.push(/(?<![A-Za-z0-9])Vue(?![A-Za-z0-9])/);
  if (label === 'REST APIs') out.push(/(?<![A-Za-z0-9])REST(?:ful)?(?![A-Za-z0-9])/);
  if (label === 'Node.js') out.push(/(?<![A-Za-z0-9])Node(?![A-Za-z0-9.])/);
  return out.length ? [{ label, res: out }] : [];
});

/** Decode the HTML entities Greenhouse uses and strip tags to plain text. */
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&amp;/g, '&') // Greenhouse double-escapes literal ampersands
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Set of canonical skill labels mentioned in a posting's text. */
export function extractSkills(text) {
  const found = new Set();
  for (const { label, res } of MATCHERS) if (res.some(re => re.test(text))) found.add(label);
  return found;
}
