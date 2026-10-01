import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, text, click, input } from './helpers.mjs';

const okPage = {
  ok: true,
  status: 200,
  json: async () => ({
    items: [
      {
        name: '<b>Юрист</b> & партнёры',
        alternate_url: 'https://hh.ru/vacancy/111',
        employer: { name: 'ООО «Тест»' },
        area: { name: 'Ростов-на-Дону' },
        salary: { from: 50000, to: 80000, currency: 'RUR' },
        experience: { name: 'От 1 года до 3 лет' },
        published_at: '2026-09-01T10:00:00+0300',
        professional_roles: [{ name: 'Юрист' }],
      },
      {
        name: 'Помощник юриста',
        alternate_url: 'https://hh.ru/vacancy/222',
        employer: { name: 'АО «Пример»' },
        area: { name: 'Ростов-на-Дону' },
        salary: null,
        experience: { name: 'Нет опыта' },
        published_at: '2026-09-02T10:00:00+0300',
        professional_roles: [],
      },
    ],
  }),
};

const { window, document, fetchCalls } = makeDom({ fetch: async () => okPage });
const tick = () => new Promise((r) => setTimeout(r, 0));

test('конструктор резюме: 5 шагов, подсказки под академию', () => {
  const steps = [...document.querySelectorAll('#rbSteps span')];
  assert.equal(steps.length, 5);
  assert.equal(steps[0].classList.contains('on'), true);
  assert.equal(document.getElementById('rbBack').style.visibility, 'hidden');

  window.eval('rbNav(1)');
  assert.match(text(document, 'toast'), /Сначала выберите вашу академию/);
  assert.equal(document.getElementById('rbName'), null, 'без академии второй шаг не открывается');

  const radio = document.querySelector('input[name=rbAcad][value=law]');
  radio.checked = true;
  window.eval('rbNav(1)');
  assert.equal(document.querySelectorAll('#rbSteps span.on').length, 2);
  assert.equal(document.getElementById('rbBack').style.visibility, 'visible');
  assert.ok(document.getElementById('rbName') && document.getElementById('rbPhone'));

  window.eval('rbNav(1)');
  assert.match(text(document, 'toast'), /Укажите имя и телефон/);

  input(window, document.getElementById('rbName'), 'Иванова Анна Сергеевна');
  input(window, document.getElementById('rbPhone'), '+7 (900) 123-45-67');
  input(window, document.getElementById('rbEmail'), 'anna@example.ru');
  window.eval('rbNav(1)');
  const positions = [...document.querySelectorAll('#rbPosition option')].map((o) => o.value);
  assert.ok(positions.length > 2, 'подсказки должностей должны зависеть от академии');

  const pos = document.querySelector('#rbPosition');
  pos.value = positions[1];
  window.eval('rbNav(1)');
  assert.ok(document.querySelectorAll('input[name=rbSkill]').length > 3, 'навыки под академию');

  window.eval('rbNav(1)');
  const preview = document.querySelector('.rb-preview');
  assert.ok(preview, 'нет предпросмотра резюме');
  assert.match(preview.textContent, /Иванова Анна Сергеевна/);
  assert.match(preview.textContent, /Академия права и государственной службы/);
  assert.equal(document.getElementById('rbNext').textContent, 'Готово');
  assert.equal(document.querySelectorAll('#rbSteps span.on').length, 5);

  const resumeText = window.eval('rbResumeText()');
  assert.match(resumeText, /РЕЗЮМЕ/);
  assert.match(resumeText, /Иванова Анна Сергеевна/);
  assert.match(resumeText, /\+7 \(900\) 123-45-67/);
});

test('конструктор резюме: копирование и выгрузка в Word', () => {
  window.eval('rbCopy()');
  assert.match(text(document, 'toast'), /Текст резюме скопирован/);
  window.eval('rbDownload()');
  assert.match(text(document, 'toast'), /Файл Word сохранён/);
});

test('конструктор резюме: шаг назад сохраняет введённые данные', () => {
  window.eval('rbNav(-1)'); // 5 -> 4
  assert.equal(document.getElementById('rbNext').textContent, 'Далее →');
  window.eval('rbNav(-1)'); // 4 -> 3
  window.eval('rbNav(-1)'); // 3 -> 2
  assert.equal(document.querySelectorAll('#rbSteps span.on').length, 2);
  assert.equal(document.getElementById('rbName').value, 'Иванова Анна Сергеевна');
  assert.equal(document.getElementById('rbPhone').value, '+7 (900) 123-45-67');
  assert.equal(document.getElementById('rbEmail').value, 'anna@example.ru');
  window.eval('rbNav(1)'); // обратно на шаг 3
  assert.ok(document.querySelector('#rbPosition').value, 'должность не сохранилась');
});

test('модальное окно «Заказать звонок»: открытие, валидация, сохранение', () => {
  const modal = document.getElementById('callModal');
  assert.equal(modal.style.display, 'none');
  window.eval('openCallModal()');
  assert.equal(modal.style.display, 'flex');
  assert.ok(document.getElementById('callName'), 'форма не отрисована');

  window.eval('submitCall()');
  assert.match(text(document, 'toast'), /Укажите имя/);

  input(window, document.getElementById('callName'), 'Пётр');
  window.eval('submitCall()');
  assert.match(text(document, 'toast'), /Проверьте телефон/);

  input(window, document.getElementById('callPhone'), '+7 900 111-22-33');
  window.eval('submitCall()');
  assert.match(text(document, 'callBox'), /Заявка принята, Пётр/);
  const saved = JSON.parse(window.localStorage.getItem('callbacks'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].p, '79001112233');

  window.eval('closeCallModal()');
  assert.equal(modal.style.display, 'none');
  window.eval('openCallModal()');
  assert.ok(document.getElementById('callName'), 'форма должна восстановиться после закрытия');
  window.eval('closeCallModal()');
});

test('форма записи на консультацию отправляется', () => {
  window.eval("goTab('book')");
  document.getElementById('bookAcad').value = 'itd';
  window.eval('submitForm()');
  const card = document.getElementById('formCard');
  assert.match(card.textContent, /Заявка принята/);
  assert.match(card.textContent, /Ваш куратор:/);
  assert.match(card.textContent, /@iubip\.ru/);
});

test('живая загрузка с hh.ru: успешный сценарий', async () => {
  window.eval("goTab('vac');openAcad('all')");
  const btn = document.querySelector('#hhBlock button');
  assert.equal(btn.textContent, 'Загрузить с hh.ru');
  click(window, btn);
  await tick();
  await tick();
  const block = document.getElementById('hhBlock');
  assert.match(fetchCalls.at(-1), /^https:\/\/api\.hh\.ru\/vacancies\?area=76/);
  assert.match(block.textContent, /Свежее с hh\.ru/);
  const cards = block.querySelectorAll('.vacancy');
  assert.equal(cards.length, 2);
  const plain = (s) => s.replace(/\u00a0/g, ' ');
  assert.equal(plain(cards[0].querySelector('.vac-salary').textContent), '50 000–80 000 ₽');
  assert.equal(cards[1].querySelector('.vac-salary').textContent, 'доход не указан');
  assert.match(cards[0].querySelector('.vac-meta').textContent, /опубликовано 01\.09\.2026/);
  assert.equal(cards[0].querySelector('.vac-title').getAttribute('rel'), 'noopener noreferrer');
  assert.equal(cards[0].querySelector('a.vac-title').textContent, '<b>Юрист</b> & партнёры');
});

test('живая загрузка с hh.ru: ошибка сети обрабатывается корректно', async () => {
  const bad = makeDom({
    fetch: async () => {
      throw new Error('network down');
    },
  });
  bad.window.eval("goTab('vac');openAcad('all')");
  const b = bad.document.querySelector('#hhBlock button');
  click(bad.window, b);
  await tick();
  await tick();
  assert.equal(b.disabled, false, 'кнопка должна снова стать активной');
  assert.equal(b.textContent, 'Загрузить с hh.ru');
  assert.match(bad.document.getElementById('toast').textContent, /hh\.ru не ответил/);
});

test('шторка «Ещё»: открытие, переход по разделу, закрытие', () => {
  const sheet = document.getElementById('moreSheet');
  const scrim = document.getElementById('scrim');
  window.eval('toggleMore()');
  assert.equal(sheet.classList.contains('open'), true);
  assert.equal(scrim.classList.contains('open'), true);

  click(window, sheet.querySelector('.sheet-list button[data-tab=prog]'));
  assert.equal(document.getElementById('prog').classList.contains('active'), true);
  assert.equal(sheet.classList.contains('open'), false, 'шторка должна закрыться после выбора');
  assert.equal(scrim.classList.contains('open'), false);

  window.eval('toggleMore()');
  window.eval('closeSheets()');
  assert.equal(sheet.classList.contains('open'), false);
});

test('шторка фильтров открывается и закрывается, в том числе по Esc', () => {
  const filters = document.getElementById('filters');
  window.eval('toggleFilters()');
  assert.equal(filters.classList.contains('open'), true);
  assert.equal(document.getElementById('scrim').classList.contains('open'), true);

  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(filters.classList.contains('open'), false);

  window.eval('toggleFilters()');
  window.eval('toggleFilters()');
  assert.equal(filters.classList.contains('open'), false, 'повторное нажатие закрывает шторку');

  window.eval('toggleFilters()');
  window.eval('closeSheets()');
  assert.equal(filters.classList.contains('open'), false);
  window.eval("goTab('vac')");
});

test('тост показывается и скрывается', () => {
  window.eval("showToast('Проверка тоста')");
  const toast = document.getElementById('toast');
  assert.equal(toast.textContent, 'Проверка тоста');
  assert.equal(toast.classList.contains('show'), true);
  window.eval('clearTimeout(toastTimer);toast.classList.remove("show")');
  assert.equal(toast.classList.contains('show'), false);
});

