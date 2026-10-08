import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, html } from './helpers.mjs';

const { window, document } = makeDom();

test('кнопки переключателя темы: шапка, топбар и шторка «Ещё»', () => {
  const btns = [...document.querySelectorAll('[data-theme-btn]')];
  assert.equal(btns.length, 3, 'кнопка темы должна быть в шапке, топбаре и шторке');
  // у круглой кнопки в шапке нет подписи — только иконка и aria-label
  const withLabel = btns.filter((b) => !b.hasAttribute('data-theme-ico'));
  assert.equal(withLabel.length, 2);
  for (const b of withLabel) assert.match(b.textContent, /Тёмная тема|Светлая тема/);
  const circle = document.querySelector('[data-theme-ico]');
  assert.equal(circle.className, 'theme-circle', 'в шапке круглая кнопка');
  assert.match(circle.getAttribute('aria-label'), /тему/, 'у круглой кнопки есть aria-label');
  assert.equal(circle.querySelectorAll('svg').length, 2, 'иконки луны и солнца');
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
    if (b.hasAttribute('data-theme-ico')) {
      assert.match(b.getAttribute('aria-label'), /тему/);
    } else {
      assert.match(b.textContent, dark ? /Светлая тема/ : /Тёмная тема/);
    }
  }
  assert.equal(document.querySelector('meta[name=theme-color]').content, dark ? '#0f0f0f' : '#0c5f97');
  assert.equal(window.localStorage.getItem('ccTheme'), now);
  window.eval('themeToggle()');
  assert.equal(document.documentElement.getAttribute('data-theme'), before);
});

test('CSS: блок тёмной темы, системное предпочтение и нетронутая светлая палитра', () => {
  assert.ok(html.includes('html[data-theme=dark]{color-scheme:dark;--surface:#0f0f0f'), 'нет блока тёмной темы');
  assert.ok(html.includes('@media (prefers-color-scheme:dark){html:not([data-theme])'), 'нет fallback для системной тёмной темы');
  assert.ok(html.includes('--surface:#ebf7ff;--card:#fff'), 'светлая палитра образца изменена');
  assert.ok(html.includes('--navy:#0c5f97') && html.includes('--amber:#e5b02a'), 'цвета образца потеряны');
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

test('линия под hero мягко пульсирует и в светлой, и в тёмной теме', () => {
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const heroRule = css.match(/\.hero\{[^}]*border-bottom:4px solid var\(--amber\)[^}]*\}/);
  assert.ok(heroRule, 'янтарная линия под hero потеряна');
  assert.match(heroRule[0], /animation:rulePulse/, 'линия должна пульсировать');
  assert.match(
    css,
    /@keyframes rulePulse\{0%,100%\{border-bottom-color:var\(--amber\)\}50%\{border-bottom-color:var\(--rule-dim\)\}\}/,
    'нет кадров пульсации',
  );

  // приглушённый цвет должен быть свой в каждой теме, иначе тёмная пульсация не видна
  const root = html.slice(html.indexOf(':root{'), html.indexOf('html[data-theme=dark]'));
  assert.match(root, /--rule-dim:#[0-9a-f]{6}/i, 'в светлой теме нет --rule-dim');
  const dark = html.match(/html\[data-theme=dark\]\{([^}]*)\}/)[1];
  assert.match(dark, /--rule-dim:rgba\(/, 'в тёмной теме свой --rule-dim');

  // и пульсация обязана выключаться настройкой «меньше движения»
  assert.match(
    css,
    /@media \(prefers-reduced-motion:reduce\)\{\*\{animation:none!important/,
    'пульсация не отключается при prefers-reduced-motion',
  );
  // кроме неё самой: она меняет только цвет, без движения, поэтому просим разрешения
  // и оставляем — иначе на машине с «меньше движений» линия не мигает вовсе
  assert.match(
    css,
    /@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\s*\/\*[^*]*\*\/\s*\.hero\{animation:rulePulse 3\.6s ease-in-out infinite!important\}/,
    'линия под hero должна мигать и при prefers-reduced-motion',
  );
});

test('глобус на белой плитке виден и в тёмной теме', () => {
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const dark = html.match(/html\[data-theme=dark\]\{([^}]*)\}/)[1];

  // в тёмной теме --azure становится белым, а плитка остаётся белой:
  // прежнее правило красило линии глобуса в цвет плитки
  assert.match(dark, /--azure:#fff/, 'ожидалось, что --azure в тёмной теме белый');
  assert.ok(
    !/html\[data-theme=dark\] \.head-logo svg/.test(css),
    'тёмная тема не должна перекрашивать линии глобуса на белой плитке',
  );

  // цвет линий берётся из navy: #0c5f97 на белом в светлой, #262626 на белом в тёмной
  assert.match(css, /\.logo-tile svg ellipse,\.logo-tile svg line,\.logo-tile svg g\{stroke:var\(--navy\)\}/);
  assert.match(dark, /--navy:#262626/, 'в тёмной теме navy должен остаться тёмным');
});

test('контраст приглушённого текста не ниже 4.5:1 в обеих темах', () => {
  const root = html.slice(html.indexOf(':root{'), html.indexOf('html[data-theme=dark]'));
  const mutedLight = root.match(/--ink-soft:(#[0-9a-f]{6})/i)[1];
  const surfaceLight = root.match(/--surface:(#[0-9a-f]{6})/i)[1];
  assert.ok(
    contrast(mutedLight, surfaceLight) >= 4.5,
    `приглушённый текст ${mutedLight} на фоне страницы ${surfaceLight}: ${contrast(mutedLight, surfaceLight).toFixed(2)}:1`,
  );
  assert.ok(
    contrast(mutedLight, '#ffffff') >= 4.5,
    `приглушённый текст ${mutedLight} на карточке: ${contrast(mutedLight, '#ffffff').toFixed(2)}:1`,
  );

  const dark = html.match(/html\[data-theme=dark\]\{([^}]*)\}/)[1];
  const mutedDark = dark.match(/--ink-soft:(#[0-9a-f]{6})/i)[1];
  const cardDark = dark.match(/--card:(#[0-9a-f]{6})/i)[1];
  assert.ok(
    contrast(mutedDark, cardDark) >= 4.5,
    `приглушённый текст ${mutedDark} на карточке тёмной темы: ${contrast(mutedDark, cardDark).toFixed(2)}:1`,
  );
});