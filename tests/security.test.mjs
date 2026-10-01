import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, html } from './helpers.mjs';

const scriptStart = html.indexOf('<script>');
const markup = html.slice(0, scriptStart);
const script = html.slice(scriptStart, html.indexOf('</script>'));

/** Тело функции из встроенного скрипта (до следующего объявления). */
function fnBody(name) {
  const i = script.indexOf('function ' + name + '(');
  assert.ok(i > 0, 'нет функции ' + name);
  const j = script.indexOf('\nfunction ', i + 10);
  return script.slice(i, j === -1 ? script.length : j);
}

test('все ссылки с target=_blank защищены от доступа к opener', () => {
  const anchors = [...markup.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  const blank = anchors.filter((a) => /target="_blank"/.test(a));
  assert.ok(blank.length >= 10, 'ожидались внешние ссылки');
  for (const a of blank) {
    assert.match(a, /rel="noopener noreferrer"/, 'нет rel у ссылки: ' + a.slice(0, 80));
  }
  const inJs = (script.match(/target="_blank"/g) || []).length;
  const rels = (script.match(/rel="noopener noreferrer"/g) || []).length;
  assert.ok(inJs > 0);
  assert.equal(inJs, rels, 'в шаблонах JS у каждой _blank-ссылки должен быть rel');
  assert.equal((script.match(/rel="noopener"/g) || []).length, 0);
});

test('динамические значения экранируются через esc()', () => {
  const raw = /'\s*\+\s*(?:v|a|x)\.[A-Za-z]+\s*\+\s*'/;
  // проверяем именно выражения, которые попадают в innerHTML
  const htmlExprs = (body) =>
    [...body.matchAll(/innerHTML\s*=\s*([^;]+);/g)].map((m) => m[1]);

  for (const fn of ['renderAcads', 'openAcad', 'renderVacs', 'renderInterns', 'renderStaff']) {
    const body = fnBody(fn);
    assert.match(body, /esc\(/, fn + ': не использует esc()');
    const exprs = htmlExprs(body);
    assert.ok(exprs.length > 0, fn + ': не найдено присваивание innerHTML');
    for (const expr of exprs) {
      const bad = expr.match(raw);
      assert.equal(bad, null, fn + ': значение без esc() -> ' + (bad && bad[0]));
    }
  }
});

test('все динамические href проходят через safeUrl()', () => {
  const badPatterns = [
    /href="'\+link\+'"/,
    /href="'\+v\.u\+'"/,
    /href="'\+x\.u\+'"/,
    /href="mailto:'\+a\.email\+'"/,
  ];
  for (const p of badPatterns) {
    assert.equal(p.test(script), false, 'небезопасный href: ' + p);
  }
  assert.ok((script.match(/safeUrl\(/g) || []).length >= 10, 'safeUrl применяется слишком редко');
});

test('CSP и код: нет unsafe-eval, eval, document.write, new Function', () => {
  const csp = markup.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(!/unsafe-eval/.test(csp));
  assert.ok(!/eval\(/.test(script), 'в коде не должно быть eval()');
  assert.ok(!/new Function/.test(script));
  assert.ok(!/document\.write/.test(script));
  assert.ok(!/innerHTML\s*=\s*[^;]*\buserInput\b/.test(script));
});

test('на странице нет форм, отправляющих данные на сторонний сервер', () => {
  const dom = makeDom();
  assert.equal(dom.document.querySelectorAll('form').length, 0);
  assert.ok(!/\baction="/.test(markup));
  assert.ok(!/XMLHttpRequest/.test(script), 'используем только fetch с белым списком CSP');
});

test('esc() экранирует все опасные символы', () => {
  const { window } = makeDom();
  const out = window.eval('esc(\'<a href="x">&\\\'<script>\')');
  assert.equal(out, '&lt;a href=&quot;x&quot;&gt;&amp;\'&lt;script&gt;');
  assert.equal(window.eval('esc(undefined)'), '');
  assert.equal(window.eval('esc(null)'), '');
});

test('XSS: подставная вакансия выводится текстом и не исполняется', () => {
  const { window, document } = makeDom();
  const alerts = [];
  window.alert = (m) => alerts.push(m);
  const evil = {
    t: '<img src=x onerror="alert(1)">Юрист-тест',
    c: '<script>alert(2)</script>ООО',
    city: '<b>город</b>',
    date: '01.01.2026',
    s: '<i>1</i>',
    tags: ['<u>tag</u>'],
    dir: 'IT',
    acad: 'itd',
    u: 'javascript:alert(3)',
  };
  window.eval('vacs.push(' + JSON.stringify(evil) + ')');
  window.eval("openAcad('all')");

  const grid = document.getElementById('grid');
  assert.equal(
    grid.querySelectorAll('.vacancy img,.vacancy script,.vacancy iframe,.vacancy svg,.vacancy b,.vacancy i,.vacancy u')
      .length,
    0,
    'в карточках появились посторонние элементы',
  );
  assert.match(grid.innerHTML, /&lt;img src=x/, 'HTML не экранирован');
  const card = [...grid.querySelectorAll('.vacancy')].find((c) =>
    c.textContent.includes('<img src=x'),
  );
  assert.ok(card, 'подставная вакансия не отрисована');
  assert.match(card.textContent, /<img src=x onerror="alert\(1\)">Юрист-тест/);
  assert.equal(card.querySelector('.vac-actions a.btn-outline').getAttribute('href'), '#');
  assert.equal(alerts.length, 0);
});

test('XSS: подставные данные академии и куратора безопасны', () => {
  const { window, document } = makeDom();
  window.eval(
    'ACADS.push(' +
      JSON.stringify({
        id: 'xss',
        name: '<img src=x onerror="alert(9)">',
        spec: '<b>s</b>',
        note: 'n',
        head: 'h',
        phone: 'p',
        email: 'evil@x.ru" onmouseover="alert(7)',
        programs: [],
        positions: [],
        skills: [],
      }) +
      ')',
  );
  window.eval('renderAcads();renderStaff()');

  const grid = document.getElementById('acadGrid');
  assert.equal(grid.querySelectorAll('img,b').length, 0);
  assert.match(grid.innerHTML, /&lt;img/);

  const cards = document.querySelectorAll('#staffGrid .amb-card');
  const last = cards[cards.length - 1];
  assert.equal(last.querySelectorAll('img').length, 0);
  assert.equal(last.querySelectorAll('[onmouseover]').length, 0);
  assert.equal(last.querySelector('a').getAttribute('href'), '#');
});

test('safeUrl: пропускает только безопасные схемы', () => {
  const { window } = makeDom();
  const ok = window.eval('safeUrl');
  assert.equal(ok('https://hh.ru/vacancy/1'), 'https://hh.ru/vacancy/1');
  assert.equal(ok('mailto:career@iubip.ru'), 'mailto:career@iubip.ru');
  assert.equal(ok('tel:+78007755012'), 'tel:+78007755012');
  assert.equal(ok('javascript:alert(1)'), '#');
  assert.equal(ok('data:text/html,<script>1</script>'), '#');
  assert.equal(ok('https://x.ru/" onmouseover="alert(1)'), '#');
  assert.equal(ok(undefined), '#');
});

test('в localStorage не остаётся лишних персональных данных', () => {
  const { window } = makeDom();
  window.eval('openCallModal()');
  window.eval(
    "document.getElementById('callName').value='Тест';" +
      "document.getElementById('callPhone').value='+7 900 123-45-67';submitCall()",
  );
  assert.equal(window.localStorage.length, 1);
  assert.equal(window.localStorage.key(0), 'callbacks');
  const saved = JSON.parse(window.localStorage.getItem('callbacks'));
  assert.deepEqual(Object.keys(saved[0]).sort(), ['n', 'p', 't']);
  assert.equal(saved[0].p, '79001234567');
});

