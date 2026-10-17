import { getTabbables, isPlainLeftClick, nextFocusTarget } from './focusLoop';

function root(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe('getTabbables', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('includes form controls and links, excludes disabled, hidden and negative tabindex', () => {
    const r = root(`
      <a href="/a" id="a">a</a>
      <a id="nohref">x</a>
      <a href="/b" tabindex="-1" id="neg">b</a>
      <button id="b">b</button><button disabled id="d">d</button>
      <input id="i" /><input type="hidden" id="h" />
      <select id="s"></select><textarea id="t"></textarea>
      <details><summary id="sum">s</summary></details>
      <div contenteditable="true" id="ce"></div>
      <div tabindex="0" id="ti"></div>
      <button style="visibility:hidden" id="vh">v</button>
      <button style="display:none" id="dn">n</button>
      <div hidden><button id="inh">h</button></div>
      <div inert><button id="ini">i</button></div>`);
    expect(getTabbables([r]).map((e) => e.id)).toEqual([
      'a',
      'b',
      'i',
      's',
      't',
      'sum',
      'ce',
      'ti',
    ]);
  });

  it('skips null roots', () => {
    expect(getTabbables([null, undefined])).toEqual([]);
  });
});

describe('nextFocusTarget', () => {
  const mk = () => {
    const panel = document.createElement('div');
    const a = document.createElement('button');
    const b = document.createElement('button');
    const c = document.createElement('button');
    panel.append(b, c);
    const text = document.createElement('p');
    panel.append(text);
    return { panel, a, b, c, text, scope: [a, b, c] };
  };

  it('wraps at both ends', () => {
    const { panel, a, c, scope } = mk();
    expect(nextFocusTarget(scope, panel, c, false)).toBe(a);
    expect(nextFocusTarget(scope, panel, a, true)).toBe(c);
  });

  it('leaves middle moves to the browser', () => {
    const { panel, b, scope } = mk();
    expect(nextFocusTarget(scope, panel, b, false)).toBeNull();
    expect(nextFocusTarget(scope, panel, b, true)).toBeNull();
  });

  it('leaves the panel itself and non-tabbable panel content to the browser', () => {
    const { panel, text, scope } = mk();
    expect(nextFocusTarget(scope, panel, panel, false)).toBeNull();
    expect(nextFocusTarget(scope, panel, panel, true)).toBeNull();
    expect(nextFocusTarget(scope, panel, text, false)).toBeNull();
  });

  it('pulls focus in from outside', () => {
    const { panel, a, c, scope } = mk();
    const outside = document.createElement('button');
    expect(nextFocusTarget(scope, panel, outside, false)).toBe(a);
    expect(nextFocusTarget(scope, panel, null, true)).toBe(c);
  });

  it('does nothing without tabbables', () => {
    expect(nextFocusTarget([], document.createElement('div'), null, false)).toBeNull();
  });
});

describe('isPlainLeftClick', () => {
  const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  it('accepts a plain primary click only', () => {
    expect(isPlainLeftClick(base)).toBe(true);
    expect(isPlainLeftClick({ ...base, button: 1 })).toBe(false);
    expect(isPlainLeftClick({ ...base, metaKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, ctrlKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, shiftKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, altKey: true })).toBe(false);
  });
});
