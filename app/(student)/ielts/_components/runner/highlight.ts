// Reading-passage highlighter (the runner's marker/pen).
//
// One gesture, no tool button: select text in the passage and it turns yellow;
// select over a yellow stretch again and the mark goes away. `toggleHighlight`
// is the whole API — the runner just calls it on every pointer release.
//
// Why this is not `range.surroundContents()`: that call throws
// (InvalidStateError) whenever a selection only PARTIALLY contains a non-text
// node — i.e. for almost every real selection, because passage blocks contain
// <br>, <b>, <i> and the selection routinely spans two paragraphs. The original
// implementation swallowed that error, which is why the marker "did nothing".
//
// Instead we walk every text node the range touches, split it down to the
// selected slice, and wrap that slice. That works for any selection, across any
// markup, and never moves nodes between parents (so the serialized per-block
// innerHTML used for session persistence stays valid).

/** Attribute stamped on every highlight span. */
export const HL_ATTR = 'data-hl';
/** Marker look — kit tokens only (gold container reads as a highlighter pen). */
export const HL_CLASS = 'bg-gold-container text-on-gold-container rounded-m3-xs px-0.5';

/** Text nodes inside `root` (and inside a [data-hl-block]) that the range touches. */
function textNodesInRange(root: HTMLElement, range: Range): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      // Only passage body text is highlightable — not the title/instruction.
      if (!node.parentElement?.closest('[data-hl-block]')) return NodeFilter.FILTER_REJECT;
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const out: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

/** Existing marks that genuinely OVERLAP the range (merely touching at a
 *  boundary does not count — otherwise marking the word after a yellow one
 *  would erase it). */
function overlappingMarks(root: HTMLElement, range: Range): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`span[${HL_ATTR}]`)).filter((mark) => {
    const markRange = document.createRange();
    markRange.selectNodeContents(mark);
    // overlap ⇔ range.start < mark.end AND range.end > mark.start
    return (
      range.compareBoundaryPoints(Range.END_TO_START, markRange) < 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, markRange) > 0
    );
  });
}

/** Unwrap one mark, preserving its children (bold/italic survive). */
function unwrap(span: Element): void {
  const parent = span.parentNode;
  if (!parent) return;
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  parent.removeChild(span);
  (parent as Element).normalize?.();
}

const inMark = (node: Text) => !!node.parentElement?.closest(`span[${HL_ATTR}]`);

/**
 * Mark the current selection, or clear the marks it covers.
 *
 * The rule is asymmetric on purpose:
 *   • selection lands ONLY on yellow text  → erase (that is "select it again");
 *   • selection touches any plain text     → mark the plain parts, keep the rest.
 * Erasing on any overlap instead would make a phrase that merely starts inside
 * an existing mark delete it and highlight nothing — which reads as "selecting
 * text does not work". It also broke triple-click: the double-click that
 * precedes it marks a word, then the paragraph selection wiped it again.
 *
 * Returns what happened so the caller can persist (or skip a no-op render).
 */
export function toggleHighlight(root: HTMLElement): 'added' | 'removed' | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!range.intersectsNode(root)) return null;

  // Snapshot every slice BEFORE touching the DOM. The range is live: splitting
  // and re-parenting text nodes can move its boundary points, and reading
  // range.endOffset after the first wrap would then over-select the rest of the
  // passage. Offsets are only meaningful against the untouched tree.
  const slices = textNodesInRange(root, range)
    .map((node) => ({
      node,
      start: node === range.startContainer ? range.startOffset : 0,
      end: node === range.endContainer ? range.endOffset : node.length,
    }))
    .filter((s) => s.start < s.end); // drop boundary-only touches

  if (!slices.length) return null;

  // Nothing but yellow under the selection → erase every mark it touches, so
  // selecting one word of a long mark clears the whole mark. Whitespace-only
  // slices are ignored in this test: re-selecting a marked word usually grabs
  // the space next to it, and that must still read as "erase", not "extend".
  const words = slices.filter((s) => s.node.nodeValue!.slice(s.start, s.end).trim());
  if (words.length && words.every((s) => inMark(s.node))) {
    const marks = overlappingMarks(root, range);
    if (!marks.length) return null;
    sel.removeAllRanges();
    marks.forEach(unwrap);
    return 'removed';
  }

  // Otherwise extend: wrap only the parts that are not marked yet (wrapping a
  // marked one would nest spans and inflate the serialized session HTML).
  const fresh = slices.filter((s) => !inMark(s.node));
  sel.removeAllRanges(); // detach the live range before mutating

  for (const { node, start, end } of fresh) {
    // splitText keeps `node` as the head, so these references stay valid.
    let slice: Text = node;
    if (end < slice.length) slice.splitText(end);
    if (start > 0) slice = slice.splitText(start);

    const span = document.createElement('span');
    span.setAttribute(HL_ATTR, '1');
    span.className = HL_CLASS;
    slice.parentNode?.insertBefore(span, slice);
    span.appendChild(slice);
  }

  return 'added';
}
