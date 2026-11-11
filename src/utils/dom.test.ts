import { describe, it, expect, vi } from 'vitest';
import {
  closestElement,
  getRequiredAnchorById,
  getRequiredElementById,
  parseTrustedSvgElement,
  trySetPointerCapture
} from './dom';

describe('dom utilities', () => {
  it('returns the element when present and throws Error when missing or wrong tag', () => {
    document.body.innerHTML =
      '<div id="stage-root"><span class="inner">text</span></div><a id="map-link" href="#"></a>';
    const found = getRequiredElementById('stage-root');
    expect(found.id).toBe('stage-root');
    expect(getRequiredAnchorById('map-link').id).toBe('map-link');
    expect(() => getRequiredAnchorById('stage-root')).toThrow(/Expected #stage-root to be an <a>/);
    expect(() => getRequiredElementById('non-existent')).toThrow(
      'Missing required DOM element: #non-existent'
    );

    const innerSpan = found.querySelector('.inner') as HTMLElement;
    const textNode = innerSpan.firstChild as Text;
    expect(closestElement(innerSpan, '#stage-root')).toBe(found);
    expect(closestElement(textNode, '#stage-root')).toBe(found);
    expect(closestElement(document.createTextNode('detached'), '#stage-root')).toBeNull();
    expect(closestElement(null, '#stage-root')).toBeNull();
  });

  it('parses valid SVG markup with aria-hidden and focusable attributes', () => {
    const svg = parseTrustedSvgElement(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    );
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('circle')).not.toBeNull();
  });

  it('throws Error on non-SVG or malformed XML input', () => {
    expect(() => parseTrustedSvgElement('<div>not an svg</div>')).toThrow(/Failed to parse/);
    expect(() => parseTrustedSvgElement('<svg><unclosed></svg>')).toThrow(/Failed to parse/);
  });

  it('captures active pointers, ignores DOMException, and rethrows unexpected errors', () => {
    const div = document.createElement('div');

    // Environment where setPointerCapture is undefined
    Object.defineProperty(div, 'setPointerCapture', {
      value: undefined,
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 1);
    }).not.toThrow();

    // Normal pointer capture succeeds
    const captureSpy = vi.fn();
    Object.defineProperty(div, 'setPointerCapture', {
      value: captureSpy,
      configurable: true
    });
    trySetPointerCapture(div, 42);
    expect(captureSpy).toHaveBeenCalledWith(42);

    // Synthetic PointerEvent throws DOMException -> safely ignored
    Object.defineProperty(div, 'setPointerCapture', {
      value: () => {
        throw new DOMException('Invalid pointer id', 'NotFoundError');
      },
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 99);
    }).not.toThrow();

    // Unexpected Error instance -> rethrown directly
    Object.defineProperty(div, 'setPointerCapture', {
      value: () => {
        throw new TypeError('Unexpected failure');
      },
      configurable: true
    });
    expect(() => {
      trySetPointerCapture(div, 99);
    }).toThrow('Unexpected failure');

    // Non-Error thrown primitive -> wrapped in standard Error
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
