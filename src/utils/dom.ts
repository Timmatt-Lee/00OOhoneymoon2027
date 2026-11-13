export function getRequiredElementById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required DOM element: #${id}`);
  }
  return el;
}

export function getRequiredAnchorById(id: string): HTMLAnchorElement {
  const el = getRequiredElementById(id);
  if (!(el instanceof HTMLAnchorElement)) {
    throw new Error(`Expected #${id} to be an <a> element.`);
  }
  return el;
}

export function getOptionalMetaById(id: string): HTMLMetaElement | null {
  const el = document.getElementById(id);
  return el instanceof HTMLMetaElement ? el : null;
}

export function closestElement(
  target: EventTarget | null | undefined,
  selector: string
): HTMLElement | null {
  if (target instanceof Element) {
    return target.closest<HTMLElement>(selector);
  }
  if (target instanceof Node && target.parentElement) {
    return target.parentElement.closest<HTMLElement>(selector);
  }
  return null;
}

function stripCommentNodes(parent: Node): void {
  for (let child = parent.firstChild; child !== null;) {
    const next = child.nextSibling;
    if (child.nodeType === Node.COMMENT_NODE) {
      parent.removeChild(child);
    } else if (child.firstChild !== null) {
      stripCommentNodes(child);
    }
    child = next;
  }
}

export function parseTrustedSvgElement(rawSvg: string): SVGSVGElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg.trim(), 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  const imported = parserError ? null : document.importNode(doc.documentElement, true);
  if (!(imported instanceof SVGSVGElement)) {
    throw new Error('Failed to parse static SVG asset into <svg> root element.');
  }
  if (imported.querySelector('script, foreignObject')) {
    throw new Error('Disallowed <script> or <foreignObject> element in static SVG asset.');
  }
  stripCommentNodes(imported);
  imported.setAttribute('aria-hidden', 'true');
  imported.setAttribute('focusable', 'false');
  return imported;
}

export function trySetPointerCapture(element: Element, pointerId: number): void {
  if (typeof element.setPointerCapture !== 'function') {
    return;
  }
  try {
    element.setPointerCapture(pointerId);
  } catch (err: unknown) {
    // Synthetic or already-released pointers throw NotFoundError/InvalidStateError DOMException; safe to ignore.
    if (err instanceof DOMException) {
      return;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}
