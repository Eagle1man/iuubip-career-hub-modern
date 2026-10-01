import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { html, INDEX } from './helpers.mjs';

const dom = new JSDOM(html);
const doc = dom.window.document;

const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>') + '</script>'.length;
const script = html.slice(scriptStart, scriptEnd);
const markup = html.slice(0, scriptStart);
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

const TABS = ['vac', 'intern', 'resume', 'amb', 'book', 'prog', 'dash', 'about', 'contacts'];

test('документ: кодировка, язык, заголовок', () => {
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /<meta charset="UTF-8">/);
  assert.ok(doc.title.includes('Центр карьеры'), 'title должен содержать «Центр карьеры»');
});

test('head: метатеги для мобильных и безопасности', () => {
  const viewport = doc.querySelector('meta[name=viewport]').getAttribute('content');
  assert.match(viewport, /width=device-width/);
  assert.match(viewport, /viewport-fit=cover/, 'нужен viewport-fit=cover для safe-area');
  assert.equal(doc.querySelector('meta[name=theme-color]').content, '#0e2f5f');
  assert.match(doc.querySelector('meta[name=referrer]').content, /strict-origin/);
  const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /connect-src[^;]*api\.hh\.ru/, 'hh.ru должен быть разрешён в connect-src');
});

test('сайт самодостаточен: без внешних скриптов, стилей и шрифтов', () => {
  assert.equal(doc.querySelectorAll('script[src]').length, 0);
  assert.equal(doc.querySelectorAll('link[rel=stylesheet]').length, 0);
  assert.ok(!/@import\s+url/.test(css));
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html));
});

test('все 9 разделов присутствуют и по умолчанию открыт один', () => {
  const pages = [...doc.querySelectorAll('section.page')];
  assert.equal(pages.length, 9);
  // порядок в документе совпадает с порядком вкладок в навигации
  assert.deepEqual(pages.map((p) => p.id), TABS);
  assert.equal(pages.filter((p) => p.classList.contains('active')).length, 1);
  assert.equal(pages.find((p) => p.classList.contains('active')).id, 'vac');
});

test('навигация: 9 кнопок десктопа, 5 в мобильной панели, 9 в шторке «Ещё»', () => {
  assert.deepEqual([...doc.querySelectorAll('.unav button')].map((b) => b.dataset.tab), TABS);
  const bnav = [...doc.querySelectorAll('.bnav button')];
  assert.equal(bnav.length, 5);
  assert.deepEqual(
    bnav.filter((b) => b.dataset.tab).map((b) => b.dataset.tab),
    ['vac', 'intern', 'resume', 'book'],
  );
  assert.ok(bnav.some((b) => !b.dataset.tab && /Ещё/.test(b.textContent)));
  assert.deepEqual([...doc.querySelectorAll('.sheet-list button')].map((b) => b.dataset.tab), TABS);
});


test('ids документа уникальны', () => {
  const seen = new Map();
  for (const el of doc.querySelectorAll('[id]')) {
    seen.set(el.id, (seen.get(el.id) || 0) + 1);
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1);
  assert.deepEqual(dupes, [], 'найдены дублирующиеся id');
});

test('каждый getElementById ссылается на существующий id', () => {
  // id, которые JS создаёт сам (в шаблонных строках) — ищем по всему файлу
  const inFile = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  // известная «мёртвая» ссылка из оригинального кода (элемента нет и в оригинале)
  const known = new Set(['usearch']);
  const referenced = [...script.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
  assert.ok(referenced.length > 15, 'ожидалось много обращений к DOM');
  const missing = [...new Set(referenced)].filter((id) => !inFile.has(id) && !known.has(id));
  assert.deepEqual(missing, []);
});

test('все inline-обработчики указывают на определённые функции', () => {
  const handlers = [
    ...markup.matchAll(/on(?:click|change|input)="([A-Za-z_$][\w$]*)\s*\(/g),
  ]
    .map((m) => m[1])
    // 'if' — это начало выражения в onclick="if(event.target===this)…"
    .filter((fn) => fn !== 'if');
  assert.ok(handlers.length > 10);
  const defined = new Set(
    [...script.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]),
  );
  const builtins = new Set(['alert', 'confirm', 'prompt', 'print', 'open']);
  const missing = [...new Set(handlers)].filter((fn) => !defined.has(fn) && !builtins.has(fn));
  assert.deepEqual(missing, []);
});

test('данные вакансий остались внутри маркеров автообновления', () => {
  const start = html.indexOf('// VAC-DATA-START');
  const end = html.indexOf('// VAC-DATA-END');
  assert.ok(start > 0 && end > start);
  assert.equal(html.indexOf('// VAC-DATA-START', start + 1), -1);
  assert.equal(html.indexOf('// VAC-DATA-END', end + 1), -1);
  const block = html.slice(start, end);
  assert.match(block, /const DATA_DATE='[^']+';const DATA_SHORT='\d{2}\.\d{2}\.\d{4}';/);
  assert.match(block, /const vacs=\[/);
  assert.match(block, /\];\s*$/);
});

test('CSS: mobile-first каркас, брейкпоинты и safe-area', () => {
  assert.match(css, /@media \(max-width:1024px\)/);
  assert.match(css, /@media \(max-width:860px\)/);
  assert.match(css, /@media \(max-width:480px\)/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /\.bnav\{display:none\}/, 'нижняя навигация скрыта на десктопе');
  assert.match(css, /\.bnav\{display:grid/, 'нижняя навигация включается на мобильных');
  assert.match(css, /font-size:16px/, 'поля 16px — защита от зума iOS');
  assert.match(css, /min-height:44px/, 'тап-таргеты не меньше 44px');
  assert.match(css, /prefers-reduced-motion/, 'уважаем настройку «меньше движения»');
});

test('бюджет страницы: один файл, разумный размер', () => {
  const bytes = Buffer.byteLength(html, 'utf8');
  assert.ok(bytes < 200 * 1024, `index.html слишком большой: ${bytes} байт`);
  assert.ok(INDEX.endsWith('index.html'));
});

test('фирменные цвета ИУБиП, старый «серый» стиль удалён', () => {
  assert.ok(!/font-family:Georgia/.test(css), 'шрифт Georgia из старой вёрстки не должен остаться');
  assert.ok(!/#f2f3f5/.test(css), 'старый серый фон не должен остаться');
  assert.match(css, /--navy:#0e2f5f/, 'фирменный синий ИУБиП');
  assert.match(css, /--gold:#c9a227/, 'фирменное золото ИУБиП');
});

test('разметка и CSS сбалансированы', () => {
  const cssBlock = css.replace(/^<style>/, '');
  const open = (cssBlock.match(/{/g) || []).length;
  const close = (cssBlock.match(/}/g) || []).length;
  assert.equal(open, close, 'несбалансированные фигурные скобки в CSS');
  assert.ok(open > 100, 'CSS подозрительно короткий: ' + open + ' правил');

  for (const tag of ['section', 'nav', 'header', 'footer', 'main', 'aside', 'style', 'script', 'div', 'button', 'ul', 'li', 'p', 'h2', 'h3']) {
    const opens = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const closes = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    assert.equal(opens, closes, `тег <${tag}> не сбалансирован: ${opens} открыт / ${closes} закрыт`);
  }
});

test('в файле не осталось следов старой вёрстки', () => {
  assert.ok(!html.includes('hero-counts'), 'остался блок hero-counts из оригинала');
  assert.ok(!html.includes('logo-mark'), 'остался неиспользуемый класс logo-mark');
  assert.ok(!html.includes('#f2f3f5'), 'остался старый серый фон');
  assert.ok(!html.includes('#0f6cbd'), 'остался инлайновый цвет ссылки из оригинала');
  assert.equal((html.match(/rel="noopener"/g) || []).length, 0);
});

test('мобильные элементы: шторки, затемнение, кнопка фильтров', () => {
  assert.ok(doc.getElementById('moreSheet'), 'нет шторки #moreSheet');
  assert.ok(doc.getElementById('scrim'), 'нет затемнения #scrim');
  assert.ok(doc.getElementById('filters'), 'нет панели фильтров #filters');
  assert.ok(doc.querySelector('.filter-fab'), 'нет кнопки открытия фильтров');
  assert.equal(doc.querySelector('#moreSheet').getAttribute('role'), 'dialog');
});
