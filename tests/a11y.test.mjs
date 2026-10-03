// Проверки, которые добавил аудит после редизайна: доступность, телефоны,
// отсутствие наследия старой вёрстки, целостность сервисных файлов.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { html, INDEX, ROOT } from './helpers.mjs';

const dom = new JSDOM(html);
const doc = dom.window.document;
const markup = html.slice(0, html.indexOf('<script>'));

test('старый шрифт Georgia вычищен и из CSS, и из инлайн-стилей', () => {
  assert.ok(!/Georgia/.test(html), 'в файле остался шрифт Georgia из старой вёрстки');
});

test('нет заглушек href="#" — все внутренние ссылки ведут на существующие разделы', () => {
  const stubs = [...markup.matchAll(/<a\b[^>]*href="#"[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(stubs, [], 'остались ссылки-заглушки: ' + stubs.join(' '));
  const anchors = [...markup.matchAll(/<a\b[^>]*href="#([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(anchors.length > 0, 'на сайте не должно быть внутренних ссылок');
  for (const a of anchors) {
    assert.ok(doc.getElementById(a), 'ссылка ведёт на несуществующий #' + a);
  }
});

test('телефоны кликабельны: минимум 3 ссылки tel: с корректным форматом', () => {
  const tels = [...doc.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'));
  assert.ok(tels.length >= 3, 'телефоны должны быть ссылками, а не текстом: ' + tels.length);
  for (const t of tels) {
    assert.match(t, /^tel:\+7\d{10}$/, 'неверный формат телефона: ' + t);
  }
  assert.ok([...doc.querySelectorAll('a[href^="tel:"]')].some((a) => a.textContent.includes('8 800')),
    'телефон 8 800 должен быть виден пользователю');
});

test('все поля формы связаны с подписью (label for или неявный label)', () => {
  const fields = [...doc.querySelectorAll('input:not([type=hidden]), select, textarea')];
  const bad = fields.filter((f) => {
    if (f.closest('label')) return false;                       // чекбоксы-радио внутри label
    if (f.getAttribute('aria-label') || f.labels?.length) return false;
    return !(f.id && doc.querySelector(`label[for="${f.id}"]`));
  });
  assert.deepEqual(
    bad.map((f) => f.id || f.type),
    [],
    'поля без подписи: ' + bad.map((f) => f.id || f.type).join(', '),
  );
});

test('динамические поля конструктора резюме тоже с for="id"', () => {
  // эти поля строятся в JS, поэтому ищем по всему файлу, а не только по разметке
  const pairs = [...html.matchAll(/<label for="(\w+)">/g)].map((m) => m[1]);
  for (const id of ['rbName', 'rbPhone', 'rbEmail', 'rbBirth', 'rbCity', 'rbCourse', 'rbPosition',
    'rbCustomPos', 'rbEmployment', 'rbSalary', 'rbProgram', 'rbYear', 'rbPractice',
    'rbCustomSkills', 'rbLangs', 'rbCourses', 'rbAbout', 'rbPhotoFile']) {
    assert.ok(pairs.includes(id), 'в конструкторе резюме нет подписи для #' + id);
  }
});

test('декоративные иконки скрыты от скринридера, кольцо — с описанием', () => {
  for (const svg of doc.querySelectorAll('.bnav svg')) {
    assert.equal(svg.getAttribute('aria-hidden'), 'true', 'иконка нижней панели должна быть aria-hidden');
    assert.equal(svg.getAttribute('focusable'), 'false');
  }
  const ring = doc.querySelector('svg.ring');
  assert.equal(ring.getAttribute('role'), 'img');
  assert.ok(ring.getAttribute('aria-label').length > 10, 'у кольца прогресса должно быть описание');
  const logo = doc.querySelector('.head-logo svg');
  assert.equal(logo.getAttribute('role'), 'img');
  assert.ok(logo.getAttribute('aria-label'));
});

test('иерархия заголовков без пропусков уровней', () => {
  let prev = 0;
  const breaks = [];
  for (const h of doc.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const lvl = Number(h.tagName[1]);
    if (prev && lvl > prev + 1) breaks.push(h.tagName + ' «' + h.textContent.trim().slice(0, 30) + '» после h' + prev);
    prev = lvl;
  }
  assert.deepEqual(breaks, [], 'пропуски уровней заголовков');
});

test('alert() не используется — только тост', () => {
  assert.ok(!/alert\(/.test(markup), 'alert() не нужен: на сайте есть тост showToast()');
  assert.match(html, /function showToast\(/);
});

test('сервисные файлы для деплоя на месте и корректны', () => {
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/career\.iubip\.ru\/sitemap\.xml/);
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/career\.iubip\.ru\/<\/loc>/);
  const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
  const meta = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const dir of ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src']) {
    assert.ok(headers.includes(dir), '_headers CSP без ' + dir);
    assert.ok(meta.includes(dir), 'meta CSP без ' + dir);
  }
  assert.ok(meta.includes('api.hh.ru') && headers.includes('api.hh.ru'));
});

test('nginx-конфиг и _headers не расходятся по критичным заголовкам', () => {
  const nginx = fs.readFileSync(path.join(ROOT, 'deploy', 'nginx.conf'), 'utf8');
  for (const h of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options']) {
    assert.ok(nginx.includes(h), 'nginx.conf без ' + h);
    assert.ok(fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').includes(h), '_headers без ' + h);
  }
  assert.ok(INDEX.endsWith('index.html'));
});