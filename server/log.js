// Structured JSON logs (one line per event). Never pass raw prompts, skills,
// goals or IPs here — log counts, enums and hashes only.

export function createLogger(sink = console) {
  return (level, event, fields = {}) => {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
    if (level === 'error') sink.error(line);
    else if (level === 'warn') sink.warn(line);
    else sink.log(line);
  };
}
