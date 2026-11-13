import { describe, it, expect, vi } from 'vitest';
import {
  closestElement,
  getOptionalMetaById,
  getRequiredAnchorById,
  getRequiredElementById,
  parseTrustedSvgElement,
  trySetPointerCapture
} from './dom';

describe('dom utilities', () => {
  it('returns typed elements when present and handles missing or mismatched tags', () => {
    document.body.innerHTML = [
      '<meta id="theme-meta" content="#070B19" />',
      '<div id="stage-root"><span class="inner">text</span></div>',
      '<a id="map-link" href="#"></a>'
    ].join('');

    const found = getRequiredElementById('stage-root');
    expect(found.id).toBe('stage-root');
    expect(getRequiredAnchorById('map-link').id).toBe('map-link');
    expect(getOptionalMetaById('theme-meta')?.content).toBe('#070B19');
    expect(getOptionalMetaById('stage-root')).toBeNull();
    expect(getOptionalMetaById('missing-meta')).toBeNull();

    expect(() => getRequiredAnchorById('stage-root')).toThrow(/Expected #stage-root to be an <a>/);
    expect(() => getRequiredElementById('non-existent')).toThrow(
      'Missing required DOM element: #non-existent'
    );

    const innerSpan = found.querySelector<HTMLElement>('.inner');
    const textNode = innerSpan?.firstChild ?? null;
    expect(closestElement(innerSpan, '#stage-root')).toBe(found);
    expect(closestElement(textNode, '#stage-root')).toBe(found);
    expect(closestElement(document.createTextNode('detached'), '#stage-root')).toBeNull();
    expect(closestElement(null, '#stage-root')).toBeNull();
  });

  it('parses valid SVG markup, strips all XML comments, and sets a11y attributes', () => {
    const svg = parseTrustedSvgElement(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><!-- root comment --><g><!-- nested comment --><circle cx="5" cy="5" r="4"/></g></svg>'
    );
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('circle')).not.toBeNull();

    const walker = document.createTreeWalker(svg, NodeFilter.SHOW_COMMENT);
    expect(walker.nextNode()).toBeNull();
  });

  it('throws Error on non-SVG, malformed XML, or disallowed <script>/<foreignObject> elements', () => {
    expect(() => parseTrustedSvgElement('<div>not an svg</div>')).toThrow(/Failed to parse/);
    expect(() => parseTrustedSvgElement('<svg><unclosed></svg>')).toThrow(/Failed to parse/);
    expect(() =>
      parseTrustedSvgElement('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')
    ).toThrow(/Disallowed/);
    expect(() =>
      parseTrustedSvgElement(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject></foreignObject></svg>'
      )
    ).toThrow(/Disallowed/);
  });

  it('captures active pointers, ignores DOMException, and rethrows unexpected errors', () => {
    const div = document.createElement('div');

    Object.defineProperty(div, 'setPointerCapture', {
      value: undefined,
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 1);
    }).not.toThrow();

    const captureSpy = vi.fn();
    Object.defineProperty(div, 'setPointerCapture', {
      value: captureSpy,
      configurable: true
    });
    trySetPointerCapture(div, 42);
    expect(captureSpy).toHaveBeenCalledWith(42);

    Object.defineProperty(div, 'setPointerCapture', {
      value: () => {
        throw new DOMException('Invalid pointer id', 'NotFoundError');
      },
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 99);
    }).not.toThrow();

    Object.defineProperty(div, 'setPointerCapture', {
      value: () => {
        throw new TypeError('Unexpected failure');
      },
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 99);
    }).toThrow('Unexpected failure');

    Object.defineProperty(div, 'setPointerCapture', {
      value: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'raw-string-fault';
      },
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 99);
    }).toThrow('raw-string-fault');
  });
});
