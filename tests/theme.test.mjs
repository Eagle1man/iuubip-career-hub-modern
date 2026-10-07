import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, html } from './helpers.mjs';

const { window, document } = makeDom();

test('кнопки переключателя темы: топбар и шторка «Ещё»', () => {
  const btns = [...document.querySelectorAll('[data-theme-btn]')];
  assert.equal(btns.length, 2);
  for (const b of btns) assert.match(b.textContent, /Тёмная тема|Светлая тема/);
});

test('переключение темы: data-theme, кнопки, theme-color, localStorage', () => {
  const before = document.documentElement.getAttribute('data-theme');
  assert.ok(before === 'light' || before === 'dark', 'тема инициализирована при загрузке');
  window.eval('themeToggle()');
  const now = document.documentElement.getAttribute('data-theme');
  assert.notEqual(now, before);
  const dark = now === 'dark';
  for (const b of document.querySelectorAll('[data-theme-btn]')) {
    assert.equal(b.getAttribute('aria-pressed'), String(dark));
    assert.match(b.textContent, dark ? /Светлая тема/ : /Тёмная тема/);
  }
  assert.equal(document.querySelector('meta[name=theme-color]').content, dark ? '#0d1424' : '#0e2f5f');
  assert.equal(window.localStorage.getItem('ccTheme'), now);
  window.eval('themeToggle()');
  assert.equal(document.documentElement.getAttribute('data-theme'), before);
});

test('CSS: блок тёмной темы, системное предпочтение и нетронутая светлая палитра', () => {
  assert.ok(html.includes('html[data-theme=dark]{color-scheme:dark;--bg:'), 'нет блока тёмной темы');
  assert.ok(html.includes('@media (prefers-color-scheme:dark){html:not([data-theme])'), 'нет fallback для системной тёмной темы');
  assert.ok(html.includes('--bg:#f4f6fb;--card:#fff'), 'светлая палитра изменена');
  assert.ok(html.includes('--navy:#0e2f5f') && html.includes('--gold:#c9a227'), 'фирменные цвета потеряны');
  assert.ok(html.includes('color:var(--heading)'), 'заголовки не переключаются на тему');
});

// Контраст приглушённого текста: именно на нём Lighthouse нашёл 4.47:1
// после перехода на светлый дизайн. Считаем по формуле WCAG, порог — 4.5:1.
function luminance(hex) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('контраст приглушённого текста не ниже 4.5:1 в обеих темах', () => {
  const root = html.slice(html.indexOf(':root{'), html.indexOf('html[data-theme=dark]'));
  const mutedLight = root.match(/--muted:(#[0-9a-f]{6})/i)[1];
  assert.ok(
    contrast(mutedLight, '#f4f6fb') >= 4.5,
    `приглушённый текст ${mutedLight} на фоне страницы: ${contrast(mutedLight, '#f4f6fb').toFixed(2)}:1`,
  );
  assert.ok(
    contrast(mutedLight, '#ffffff') >= 4.5,
    `приглушённый текст ${mutedLight} на карточке: ${contrast(mutedLight, '#ffffff').toFixed(2)}:1`,
  );

  const dark = html.match(/html\[data-theme=dark\]\{([^}]*)\}/)[1];
  const mutedDark = dark.match(/--muted:(#[0-9a-f]{6})/i)[1];
  const cardDark = dark.match(/--card:(#[0-9a-f]{6})/i)[1];
  assert.ok(
    contrast(mutedDark, cardDark) >= 4.5,
    `приглушённый текст ${mutedDark} на карточке тёмной темы: ${contrast(mutedDark, cardDark).toFixed(2)}:1`,
  );
});