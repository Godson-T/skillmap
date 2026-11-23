// Title → target-role and location → region matching for job postings.
// Heuristic by design; the UI shows the sample size and source so users can judge it.

import { TARGET_ROLES } from '../../shared/options.js';

const TECH_TITLE = /engineer|developer|scientist|architect|programmer|\bsre\b|tech(nical)? lead/i;

export const ROLE_PATTERNS = {
  'AI Engineer': /\b(ai|ml|machine learning|llm|genai|generative ai)\b.*\b(engineer|developer)\b|\bapplied (ai|ml)\b/i,
  'Full Stack Developer': /full[\s-]?stack/i,
  'Backend Engineer': /back[\s-]?end/i,
  'Frontend Engineer': /front[\s-]?end/i,
  'Data Scientist': /data scien/i,
  'Machine Learning Engineer': /\b(machine learning|ml)\b.*\b(engineer|developer)\b/i,
  'DevOps Engineer': /dev[\s-]?ops/i,
  'Cloud Architect': /cloud.*architect|architect.*cloud|cloud (infrastructure )?engineer/i,
  'Mobile Developer': /\b(mobile|ios|android)\b/i,
  'iOS Developer': /\bios\b/i,
  'Android Developer': /\bandroid\b/i,
  'React Native Developer': /react native|\bmobile\b/i,
  'Data Engineer': /\bdata engineer|analytics engineer|data platform/i,
  'Platform Engineer': /platform engineer|infrastructure engineer/i,
  'Site Reliability Engineer (SRE)': /site reliability|\bsre\b|reliability engineer|production engineer/i,
  'Solutions Architect': /solutions? (architect|engineer)/i,
  'Tech Lead': /tech(nical)? lead|staff (software )?engineer/i,
  'Engineering Manager': /engineering manager|manager,? (software )?engineering|head of engineering/i,
  'Software Architect': /software architect|principal (software )?engineer/i,
  'Cybersecurity Engineer': /security (engineer|analyst)|appsec|application security|cyber ?security|detection engineer/i,
  'Blockchain Developer': /blockchain|crypto|web3|smart contract/i,
  'Game Developer': /\bgame/i,
  'Product Engineer': /product engineer/i,
  'AI Research Scientist': /research (scientist|engineer)/i,
  'NLP Engineer': /\bnlp\b|natural language|\bllm\b/i,
  'Web3 Developer': /web3|blockchain|smart contract|crypto/i,
  'Computer Vision Engineer': /computer vision|\bvision\b|perception|imaging/i,
  'Robotics Engineer': /robotic|autonomy|perception|embedded/i,
  'Fintech Engineer': /payment|fintech|financial|ledger|banking/i,
};

const STOP = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'in', 'for', 'to', 'senior', 'junior', 'sr', 'jr']);

/** Return a predicate that tests a posting title against the target role. */
export function roleMatcher(goal) {
  if (ROLE_PATTERNS[goal]) {
    const re = ROLE_PATTERNS[goal];
    return (title) => re.test(title) && TECH_TITLE.test(title);
  }
  // Custom role: every meaningful word must appear in the title.
  const words = goal.toLowerCase().split(/[^\p{L}\p{N}+#]+/u).filter(w => w.length > 1 && !STOP.has(w));
  if (!words.length) return () => false;
  return (title) => {
    const t = title.toLowerCase();
    return words.every(w => t.includes(w));
  };
}

const US_STATES = 'al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc';

export const LOCATION_PATTERNS = {
  US: new RegExp(`united states|\\busa\\b|\\bu\\.?s\\.?(?![a-z])|\\bus[- ]remote|new york|\\bnyc\\b|san francisco|\\bsf\\b|seattle|chicago|austin|boston|los angeles|denver|atlanta|washington|bay area|, (${US_STATES})\\b`, 'i'),
  India: /india|bengaluru|bangalore|mumbai|pune|hyderabad|delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad/i,
  UK: /united kingdom|\buk\b|england|scotland|wales|london|manchester|edinburgh|bristol|belfast/i,
  EU: /\beu\b|europe|emea|ireland|dublin|germany|berlin|munich|france|paris|netherlands|amsterdam|spain|madrid|barcelona|portugal|lisbon|italy|milan|poland|warsaw|krakow|sweden|stockholm|denmark|copenhagen|finland|helsinki|austria|vienna|belgium|brussels|czech|prague|romania|bucharest|greece|athens|estonia|tallinn/i,
  Remote: /remote|anywhere|distributed/i,
};

export const locationMatcher = (location) => {
  const re = LOCATION_PATTERNS[location];
  return (loc, workplaceType) => (location === 'Remote' && workplaceType === 'remote') || re.test(loc || '');
};

export { TARGET_ROLES };
