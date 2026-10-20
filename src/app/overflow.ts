/** True when an element's content is taller than its box, so it scrolls. */
export function hasVerticalOverflow(el: { scrollHeight: number; clientHeight: number }): boolean {
  return el.scrollHeight > el.clientHeight;
}
