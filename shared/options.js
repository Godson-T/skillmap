// Fixed option lists shared by the UI (autocomplete / selects) and the API
// (input validation). Keep this file dependency-free: it is bundled into the
// browser build and imported by the serverless function.

export const LOCATIONS = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'India', label: '🇮🇳 India' },
  { value: 'EU', label: '🇪🇺 Europe (EU)' },
  { value: 'UK', label: '🇬🇧 United Kingdom' },
  { value: 'Remote', label: '🌏 Remote / Global' },
];
export const LOCATION_VALUES = LOCATIONS.map(l => l.value);

export const SUGGESTED_SKILLS = [
  // Core Web
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte',
  'HTML5', 'CSS3', 'Tailwind CSS', 'Framer Motion', 'Three.js', 'WebGL',
  // Backend & APIs
  'Node.js', 'Express.js', 'NestJS', 'Bun', 'Deno',
  'Python', 'FastAPI', 'Django', 'Flask',
  'Java', 'Spring Boot', 'Go', 'Rust', 'PHP', 'Laravel', 'C#', '.NET', 'C++',
  'GraphQL', 'tRPC', 'REST APIs', 'gRPC', 'WebSockets',
  // AI / ML
  'Machine Learning', 'Deep Learning', 'LangChain', 'LlamaIndex',
  'Prompt Engineering', 'RAG', 'Fine-tuning LLMs', 'Hugging Face',
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'OpenAI API', 'Ollama', 'MLflow',
  // Data
  'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'MySQL', 'SQLite', 'Supabase',
  'Pandas', 'NumPy', 'Apache Spark', 'dbt', 'Airflow', 'Kafka',
  // DevOps & Cloud
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Vercel', 'Terraform', 'Ansible',
  'GitHub Actions', 'CI/CD', 'Linux', 'Nginx', 'Monitoring & Observability',
  // Mobile
  'React Native', 'Flutter', 'Swift', 'SwiftUI', 'Kotlin', 'Jetpack Compose', 'Expo',
  // Tools & Concepts
  'Git', 'System Design', 'Microservices', 'DevOps', 'OAuth / JWT', 'Testing (Jest / Vitest)',
];

export const TARGET_ROLES = [
  'AI Engineer', 'Full Stack Developer', 'Backend Engineer', 'Frontend Engineer',
  'Data Scientist', 'Machine Learning Engineer', 'DevOps Engineer', 'Cloud Architect',
  'Mobile Developer', 'iOS Developer', 'Android Developer', 'React Native Developer',
  'Data Engineer', 'Platform Engineer', 'Site Reliability Engineer (SRE)',
  'Solutions Architect', 'Tech Lead', 'Engineering Manager', 'Software Architect',
  'Cybersecurity Engineer', 'Blockchain Developer', 'Game Developer',
  'Product Engineer', 'AI Research Scientist', 'NLP Engineer', 'Web3 Developer',
  'Computer Vision Engineer', 'Robotics Engineer', 'Fintech Engineer',
];

// Input limits, enforced server-side and mirrored in the UI.
export const LIMITS = {
  maxSkills: 25,
  maxSkillLength: 40,
  maxSkillsChars: 800,
  maxCustomGoalLength: 60,
  maxSkillWords: 5,
  maxGoalWords: 8,
};
