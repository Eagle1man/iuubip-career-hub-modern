import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX = path.join(ROOT, 'index.html');
export const html = fs.readFileSync(INDEX, 'utf8');
export const PAGE_URL = 'https://career.iubip.ru/';

/** Открывает index.html как страницу и выполняет весь встроенный JS. */
export function makeDom(options = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e));

  const fetchCalls = [];
  const fetchImpl =
    options.fetch ||
    (async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: PAGE_URL,
    virtualConsole: vc,
    beforeParse(window) {
      // то, что jsdom не реализует, но использует сайт
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      window.open = () => null;
      window.HTMLAnchorElement.prototype.click = function () {};
      window.document.execCommand = () => true;
      window.URL.createObjectURL = () => 'blob:mock';
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function () {};
      window.fetch = (url, init) => {
        fetchCalls.push(String(url));
        return fetchImpl(url, init);
      };
    },
  });

  return { dom, window: dom.window, document: dom.window.document, errors, fetchCalls };
}

/** Простой помощник: текстовое содержимое элемента по id. */
export function text(doc, id) {
  const el = doc.getElementById(id);
  return el ? el.textContent.trim() : null;
}

export function click(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function input(win, el, value) {
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}

export function change(win, el, value) {
  if (value !== undefined) el.value = value;
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}
