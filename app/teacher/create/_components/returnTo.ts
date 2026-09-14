// app/teacher/create/_components/returnTo.ts
//
// The `?back=` contract — how a PAPER BUILDER sends a teacher off to write a
// question and gets them back.
//
// The Milliy sertifikat builders (maths and the subject papers) hold the paper in
// component state and stash it to localStorage before leaving, so the paper
// survives the trip. What it did NOT survive is the teacher: `/teacher/create/question`
// dropped them at the create hub afterwards, and finding the way back to a
// half-built paper was theirs to work out. So the builder now says where it came
// from, and the question builder returns there on save — carrying the id of what
// was just written, so the paper picks it up without the teacher hunting for it
// in the bank picker.
//
// ⚠️ `back` arrives from the URL, so it is USER INPUT: only an in-app teacher
// path is ever pushed. Anything else is treated as absent.

/** A `?back=` value that is safe to `router.push`, or `null`. */
export function safeBackTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  // `/teacher/…` is the whole allowance: it rules out `//host`, `https://host`
  // and `javascript:` by construction, and there is no other tree a paper
  // builder lives in.
  if (!value.startsWith('/teacher/')) return null;
  if (value.includes('\\')) return null;
  return value;
}

/**
 * The return trip, carrying the question that was just written so the builder
 * can drop it straight onto the paper (`?add=`).
 *
 * Any query the builder put on its own `back` (`?id=` when editing a stored
 * paper) is preserved — losing it would return the teacher to a NEW paper.
 */
export function backWithQuestion(back: string, questionId: string): string {
  const [pathAndQuery] = back.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const params = new URLSearchParams(query);
  params.set('add', questionId);
  return `${path}?${params.toString()}`;
}

/**
 * The link a paper builder renders to send the teacher to a question builder.
 *
 * `subjectSlug` pre-picks the **Fan** dropdown, so a biology paper cannot send a
 * teacher off to write a question that lands under maths and then refuse it on
 * the way back.
 */
export function questionBuilderHref(
  route: string,
  back: string,
  subjectSlug?: string | null,
): string {
  const params = new URLSearchParams({ back });
  if (subjectSlug) params.set('subject', subjectSlug);
  return `${route}?${params.toString()}`;
}
