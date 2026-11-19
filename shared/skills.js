// Normalized skill taxonomy + skill-gap math.
//
// Replaces the old "first word + substring" matching, which treated
// "Machine Learning" as "machine" and let a skill named "C" match anything
// containing the letter c. Matching is now exact on a canonical key after
// alias resolution, so results are explainable: every match maps to one
// canonical skill.

import { SUGGESTED_SKILLS } from './options.js';

// Skills that commonly appear in model output / job ads but are not in the
// autocomplete list. They exist only so aliases resolve to a stable label.
const EXTRA_SKILLS = [
  'Data Structures & Algorithms', 'Statistics', 'MLOps', 'NLP', 'Computer Vision',
  'LLMs', 'R', 'Scala', 'Bash', 'Elasticsearch', 'Snowflake', 'BigQuery', 'Databricks',
  'Serverless', 'Prometheus', 'Grafana', 'Jenkins', 'Unity', 'Unreal Engine', 'Solidity',
  'ROS', 'OpenCV', 'Vector Databases', 'Power BI', 'Tableau', 'Excel', 'Data Visualization',
];

// canonical label -> aliases (case/spacing/punctuation-insensitive)
const ALIASES = {
  'JavaScript': ['js', 'ecmascript', 'es6', 'vanilla js'],
  'TypeScript': ['ts'],
  'React': ['reactjs', 'react js'],
  'Next.js': ['next'],
  'Vue.js': ['vue'],
  'Angular': ['angularjs'],
  'HTML5': ['html'],
  'CSS3': ['css'],
  'Tailwind CSS': ['tailwind'],
  'Node.js': ['node'],
  'Express.js': ['express'],
  'NestJS': ['nest'],
  'Python': ['py', 'python3'],
  'Go': ['golang'],
  'C#': ['csharp', 'c sharp'],
  '.NET': ['dotnet', 'asp.net', '.net core', 'asp.net core'],
  'C++': ['cpp', 'cplusplus'],
  'REST APIs': ['rest', 'rest api', 'restful', 'restful apis', 'restful api'],
  'WebSockets': ['websocket', 'socket.io'],
  'Machine Learning': ['ml'],
  'Deep Learning': ['dl', 'neural networks'],
  'Prompt Engineering': ['prompting'],
  'RAG': ['retrieval augmented generation'],
  'Fine-tuning LLMs': ['fine tuning', 'finetuning', 'llm fine tuning', 'lora'],
  'Hugging Face': ['huggingface', 'hugging face transformers'],
  'Scikit-learn': ['sklearn'],
  'OpenAI API': ['openai'],
  'PostgreSQL': ['postgres', 'psql'],
  'MongoDB': ['mongo'],
  'Apache Spark': ['spark', 'pyspark'],
  'Airflow': ['apache airflow'],
  'Kafka': ['apache kafka'],
  'Kubernetes': ['k8s'],
  'AWS': ['amazon web services'],
  'GCP': ['google cloud', 'google cloud platform'],
  'Azure': ['microsoft azure'],
  'GitHub Actions': ['gh actions'],
  'CI/CD': ['ci cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  'Monitoring & Observability': ['observability', 'monitoring'],
  'Git': ['github', 'version control'],
  'Microservices': ['microservice', 'microservices architecture'],
  'OAuth / JWT': ['oauth', 'oauth2', 'jwt'],
  'Testing (Jest / Vitest)': ['testing', 'unit testing', 'jest', 'vitest'],
  'NLP': ['natural language processing'],
  'LLMs': ['llm', 'large language models', 'large language model'],
  'Data Structures & Algorithms': ['dsa', 'data structures and algorithms'],
  'MLOps': ['ml ops'],
  'Statistics': ['stats', 'statistical analysis'],
  'Bash': ['shell scripting', 'shell'],
  'Vector Databases': ['vector db', 'vector database'],
};

/** Lowercase, Unicode-normalize, collapse whitespace, drop trailing version numbers. */
export function baseKey(raw) {
  return String(raw ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+v?\d+(\.\d+)*(\+)?$/, ''); // "python 3", "react 18", "java 17+"
}

/** Remove separators that vary between spellings ("node.js" == "nodejs" == "node js"). */
const squash = (k) => k.replace(/[\s.\-_]/g, '');

const LOOKUP = new Map();
for (const label of [...SUGGESTED_SKILLS, ...EXTRA_SKILLS]) LOOKUP.set(squash(baseKey(label)), label);
for (const [label, aliases] of Object.entries(ALIASES)) {
  for (const a of aliases) LOOKUP.set(squash(baseKey(a)), label);
}

/**
 * Resolve one skill string to a canonical entry.
 * @returns {{ id: string, label: string, known: boolean } | null}
 */
export function canonicalSkill(raw) {
  const k = baseKey(raw);
  if (!k) return null;
  const tryKey = (key) => {
    const label = LOOKUP.get(squash(key));
    return label ? { id: squash(baseKey(label)), label, known: true } : null;
  };
  const hit = tryKey(k) || tryKey(k.replace(/\s*\([^)]*\)\s*/g, ' ').trim());
  if (hit) return hit;
  return { id: squash(k), label: String(raw).trim(), known: false };
}

const COMPOSITE_SPLIT = /\s*(?:\/|&|,|;|\band\b|\bor\b)\s*/i;

/**
 * Expand a possibly-composite skill ("Docker & Kubernetes", "AWS/GCP") into
 * canonical entries. Known whole names (e.g. "CI/CD", "OAuth / JWT") are kept
 * intact; unknown composites are split into their parts.
 */
export function expandSkill(raw) {
  const whole = canonicalSkill(raw);
  if (!whole || whole.known) return whole ? [whole] : [];
  const stripped = baseKey(raw).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const parts = stripped.split(COMPOSITE_SPLIT).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [whole];
  return parts.map(canonicalSkill).filter(Boolean);
}

/** Canonicalize a list (or comma-separated string) of skills, de-duplicated by id. */
export function normalizeSkillList(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  const seen = new Map();
  for (const raw of list) {
    for (const s of expandSkill(raw)) if (!seen.has(s.id)) seen.set(s.id, s);
  }
  return [...seen.values()];
}

/**
 * Share of the skills required across all career paths that the user already has.
 * @returns {{ percent: number, matched: string[], missing: string[], total: number } | null}
 */
export function computeSkillGap(userSkills, careerPaths) {
  const mine = new Set(normalizeSkillList(userSkills).map(s => s.id));
  const neededRaw = [];
  for (const p of careerPaths ?? []) for (const st of p?.steps ?? []) neededRaw.push(...(st?.skillsNeeded ?? []));
  const needed = normalizeSkillList(neededRaw);
  if (!needed.length) return null;
  const matched = needed.filter(s => mine.has(s.id));
  const missing = needed.filter(s => !mine.has(s.id));
  return {
    percent: Math.round((matched.length / needed.length) * 100),
    matched: matched.map(s => s.label),
    missing: missing.map(s => s.label),
    total: needed.length,
  };
}

/**
 * Every surface form (label + aliases) for each canonical skill. Used by the
 * job-posting extractor, which needs the raw spellings rather than lookup keys.
 * @returns {Array<{ label: string, forms: string[] }>}
 */
export function skillSurfaceForms() {
  return [...new Set([...SUGGESTED_SKILLS, ...EXTRA_SKILLS])].map(label => ({
    label,
    forms: [label, ...(ALIASES[label] ?? [])],
  }));
}
