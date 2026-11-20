// User-facing copy derived from /api/market results.

/** Plain-language note for a partial count (some boards or postings could not be read). */
export function partialNote(m) {
  const parts = [];
  if (m.boards && m.boards.ok < m.boards.queried) parts.push(`${m.boards.queried - m.boards.ok} of ${m.boards.queried} job boards didn’t respond`);
  const unread = (m.detailsFailed ?? 0) + (m.truncated ?? 0);
  if (unread > 0) parts.push(`${unread} matching posting${unread === 1 ? '' : 's'} couldn’t be read in time`);
  return `Partial count: ${parts.join(', and ') || 'some sources were unavailable'}. Try again in a few minutes for a fuller sample.`;
}
