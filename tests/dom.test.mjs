import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, text, click, input, change } from './helpers.mjs';

/** Одна страница на весь файл — экономим время (jsdom + парсинг 117 КБ). */
const { window, document, errors } = makeDom();
const num = (id) => Number(text(document, id));

test('страница загружается без ошибок jsdom', () => {
  assert.deepEqual(errors.map((e) => e.message), []);
});

test('hero-статистика подставляется из данных', () => {
  assert.equal(num('cntVac'), window.eval('vacs.length'));
  assert.equal(num('cntInt'), window.eval('INTERNS.length'));
  assert.ok(num('cntVac') >= 20, 'в подборке должно быть не меньше 20 вакансий');
  assert.equal(text(document, 'kpiVac'), String(window.eval('vacs.length')));
  assert.equal(text(document, 'dataShort'), window.eval('DATA_SHORT'));
});

test('карточки академий: 5 штук, у каждой счётчик вакансий', () => {
  const cards = [...document.querySelectorAll('#acadGrid .acad-card')];
  assert.equal(cards.length, window.eval('ACADS.length'));
  assert.equal(cards.length, 5);
  for (const c of cards) {
    assert.ok(c.querySelector('.acad-head').textContent.length > 5, 'у карточки нет названия академии');
    assert.ok(c.querySelector('.art-tile svg'), 'у карточки нет иллюстрации');
    assert.ok(c.querySelector('.card-arrow'), 'у названия нет стрелки');
    assert.match(c.querySelector('.cnt').textContent, /\d+\s+ваканси/);
    assert.ok(c.querySelector('.go').textContent.includes('Открыть'));
  }
});

test('фильтр направлений: радио и выпадающий список заполнены', () => {
  assert.ok(document.querySelectorAll('input[name=dir]').length >= 11);
  assert.equal(document.querySelector('input[name=dir][value=all]').checked, true);
  assert.ok(document.querySelectorAll('#filter option').length >= 11);
  assert.equal(document.querySelector('#filter').value, 'all');
});

test('стажировки: пилюли академий, карточки и панели медиков/юристов', () => {
  const pills = [...document.querySelectorAll('#intPills .pill')];
  assert.equal(pills.length, window.eval('ACADS.length') + 1);
  assert.equal(pills[0].dataset.a, 'all');
  assert.equal(pills[0].classList.contains('on'), true);
  assert.equal(document.querySelectorAll('#intGrid .vacancy').length, window.eval('INTERNS.length'));
  assert.equal(document.querySelectorAll('#medPanel .panel').length, 1);
  assert.equal(document.querySelectorAll('#lawPanel .panel').length, 1);
});

test('клик по пилюле академии фильтрует стажировки', () => {
  const expected = window.eval('INTERNS.filter(v=>v.acads.indexOf("itd")>=0).length');
  click(window, document.querySelector('#intPills .pill[data-a="itd"]'));
  assert.equal(document.querySelectorAll('#intGrid .vacancy').length, expected);
  assert.equal(num('cntInt'), expected);
  // renderIntPills перерисовывает список, поэтому берём актуальный элемент
  assert.equal(
    document.querySelector('#intPills .pill[data-a="itd"]').classList.contains('on'),
    true,
  );
  assert.equal(document.querySelector('#intPills .pill[data-a="all"]').classList.contains('on'), false);
  click(window, document.querySelector('#intPills .pill[data-a="all"]'));
  assert.equal(document.querySelectorAll('#intGrid .vacancy').length, window.eval('INTERNS.length'));
});

test('кураторы академий и график трудоустройства построены', () => {
  assert.equal(document.querySelectorAll('#staffGrid .amb-card').length, 5);
  const first = document.querySelector('#staffGrid .amb-card');
  assert.match(first.textContent, /Руководитель:/);
  assert.match(first.querySelector('a[href^="mailto:"]').getAttribute('href'), /@iubip\.ru/);
  assert.equal(document.querySelectorAll('#bars .brow').length, 6);
  assert.equal(document.querySelectorAll('#bars .bfill').length, 6);
});

test('форма записи: 5 академий и 7 дней на выбор', () => {
  assert.equal(document.querySelectorAll('#bookAcad option').length, 5);
  assert.equal(document.querySelectorAll('#dateSel option').length, 7);
});

test('переключение всех 9 вкладок: раздел, десктоп-навигация и мобильная синхронны', () => {
  const tabs = ['vac', 'intern', 'resume', 'amb', 'book', 'prog', 'dash', 'about', 'contacts'];
  for (const id of tabs) {
    window.eval(`goTab('${id}')`);
    assert.equal(document.getElementById(id).classList.contains('active'), true, `${id} не открылся`);
    assert.equal(document.querySelectorAll('section.page.active').length, 1);
    assert.equal(
      document.querySelector(`.unav button[data-tab=${id}]`).classList.contains('active'),
      true,
    );
    assert.equal(
      document.querySelector(`.sheet-list button[data-tab=${id}]`).classList.contains('active'),
      true,
    );
    const inBnav = ['vac', 'intern', 'resume', 'book'].includes(id);
    const activeBnav = document.querySelector('.bnav button.active');
    assert.equal(Boolean(activeBnav), inBnav, `нижняя панель для ${id}`);
    if (inBnav) assert.equal(activeBnav.dataset.tab, id);
  }
});

test('клик по кнопке нижней панели открывает раздел', () => {
  click(window, document.querySelector('.bnav button[data-tab=intern]'));
  assert.equal(document.getElementById('intern').classList.contains('active'), true);
  assert.equal(document.getElementById('vac').classList.contains('active'), false);
  window.eval("goTab('vac')");
});

test('сценарий «академия → вакансии → назад»', () => {
  assert.equal(document.getElementById('acadView').style.display, '');
  assert.equal(document.getElementById('vacView').style.display, 'none');

  click(window, document.querySelector('#acadGrid .acad-card'));
  assert.equal(document.getElementById('acadView').style.display, 'none');
  assert.equal(document.getElementById('vacView').style.display, '');
  const title = text(document, 'vacAcadTitle');
  assert.ok(title.length > 5 && title !== 'Все вакансии');
  assert.match(text(document, 'vacAcadSub'), /Руководитель:/);
  const cards = document.querySelectorAll('#grid .vacancy');
  assert.ok(cards.length > 0, 'после выбора академии не показано ни одной вакансии');
  assert.equal(cards.length, num('cntVac'));
  assert.match(text(document, 'count'), /Найдено: \d+ · данные на /);

  click(window, document.querySelector('#vacView .backlink button'));
  assert.equal(document.getElementById('acadView').style.display, '');
  assert.equal(document.getElementById('vacView').style.display, 'none');
});

test('карточка вакансии содержит все обязательные элементы', () => {
  window.eval("openAcad('all')");
  const card = document.querySelector('#grid .vacancy');
  assert.ok(card.querySelector('.vac-title').textContent.length > 2);
  assert.ok(card.querySelector('.vac-salary').textContent.length > 2);
  assert.match(card.querySelector('.vac-sub').textContent, /·/);
  assert.match(card.querySelector('.vac-meta').textContent, /Опубликовано \d{2}\.\d{2}\.\d{4}/);
  assert.ok(card.querySelector('.vac-desc').textContent.length > 20);
  assert.ok(card.querySelectorAll('.vac-skills .skill').length >= 1);
  assert.equal(card.querySelector('.vac-title').getAttribute('target'), '_blank');
  assert.equal(card.querySelector('.vac-title').getAttribute('rel'), 'noopener noreferrer');
  assert.ok(card.querySelector('.vac-actions button.btn-navy'));
  assert.ok(document.getElementById('hhBlock'), 'блок hh.ru не добавлен к списку');
});

test('поиск по строке фильтрует вакансии и показывает заглушку', () => {
  window.eval("openAcad('all')");
  const search = document.getElementById('search');
  input(window, search, 'юрист');
  const expected = window.eval('vacs.filter(v=>hay(v).includes("юрист")).length');
  assert.ok(expected > 0);
  assert.equal(document.querySelectorAll('#grid .vacancy').length, expected);
  assert.equal(num('cntVac'), expected);
  assert.match(text(document, 'count'), new RegExp(`Найдено: ${expected}`));

  input(window, search, 'ё-нет-такого-запроса-ё');
  assert.equal(document.querySelectorAll('#grid .vacancy').length, 0);
  assert.match(document.getElementById('grid').textContent, /ничего не нашлось/);
  assert.match(document.getElementById('grid').textContent, /8 800 77-55-012/);

  input(window, search, '');
  assert.equal(document.querySelectorAll('#grid .vacancy').length, window.eval('vacs.length'));
});

test('фильтр по направлению: список и радио синхронны', () => {
  window.eval("openAcad('all')");
  const filter = document.getElementById('filter');
  change(window, filter, 'IT');
  const expected = window.eval('vacs.filter(v=>v.dir==="IT").length');
  assert.ok(expected > 0);
  assert.equal(document.querySelectorAll('#grid .vacancy').length, expected);

  const radio = document.querySelector('input[name=dir][value="Медицина"]');
  radio.checked = true;
  change(window, radio);
  const med = window.eval('vacs.filter(v=>v.dir==="Медицина").length');
  assert.equal(document.querySelectorAll('#grid .vacancy').length, med);
  assert.equal(filter.value, 'Медицина', 'выпадающий список должен синхронизироваться с радио');

  click(window, document.querySelector('#acadGrid .acad-card'));
  assert.equal(document.querySelector('input[name=dir][value=all]').checked, true);
});

test('быстрый поиск из hero подставляет запрос и открывает все вакансии', () => {
  window.eval("q('Экономист')");
  assert.equal(document.getElementById('search').value, 'Экономист');
  assert.equal(document.getElementById('vacView').style.display, '');
  assert.equal(text(document, 'vacAcadTitle'), 'Все вакансии');
  const expected = window.eval('vacs.filter(v=>hay(v).includes("экономист")).length');
  assert.equal(document.querySelectorAll('#grid .vacancy').length, expected);
});

test('кнопка «Версия для слабовидящих» переключает режим', () => {
  window.eval('lvToggle()');
  assert.match(text(document, 'toast'), /крупный шрифт включён/);
  assert.equal(document.getElementById('toast').classList.contains('show'), true);
  window.eval('lvToggle()');
  assert.match(text(document, 'toast'), /Обычная версия сайта/);
});

