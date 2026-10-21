/** True when an element's content is taller than its box, so it scrolls. */
export function hasVerticalOverflow(el: { scrollHeight: number; clientHeight: number }): boolean {
  return el.scrollHeight > el.clientHeight;
}

/** True when an element's text is wider than its box, so it is cut off (an ellipsis). */
export function hasHorizontalOverflow(el: { scrollWidth: number; clientWidth: number }): boolean {
  return el.scrollWidth > el.clientWidth + 1;
}

/** True when any of the given text elements is cut off. */
export function anyTruncated(
  elements: Iterable<{ scrollWidth: number; clientWidth: number }>,
): boolean {
  for (const el of elements) if (hasHorizontalOverflow(el)) return true;
  return false;
}
