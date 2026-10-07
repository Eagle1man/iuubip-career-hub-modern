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