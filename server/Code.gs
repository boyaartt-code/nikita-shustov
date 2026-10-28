/**
 * Сервер для сайта Никиты Шустова (Google Apps Script + Google Таблица).
 *
 * Что делает:
 *  - хранит общие события календаря и заметки (листы «События» и «Заметки»);
 *  - разрешает изменения только по PIN-коду.
 *  Матчи «Баварии» сайт загружает сам напрямую из OpenLigaDB.
 *
 * Настройка (один раз): Проект → Настройки проекта → Свойства скрипта:
 *    PIN — код для редактирования (например 2580)
 */

const SHEETS = {
  events: { name: 'События', cols: ['id', 'date', 'time', 'title', 'created'] },
  notes: { name: 'Заметки', cols: ['id', 'title', 'text', 'updated'] },
};

// ---------------- HTTP
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'all';
  try {
    return json({ ok: true, events: readAll('events'), notes: readAll('notes') });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'checkpin') return json({ ok: checkPin(body.pin) });
    if (!checkPin(body.pin)) return json({ ok: false, error: 'pin' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      switch (body.action) {
        case 'addEvent':
          append('events', { id: uid(), date: clean(body.date, 10), time: clean(body.time, 5), title: clean(body.title, 120), created: new Date().toISOString() });
          break;
        case 'delEvent': remove('events', body.id); break;
        case 'saveNote':
          if (body.id) update('notes', body.id, { title: clean(body.title, 80), text: clean(body.text, 2000), updated: new Date().toISOString() });
          else append('notes', { id: uid(), title: clean(body.title, 80), text: clean(body.text, 2000), updated: new Date().toISOString() });
          break;
        case 'delNote': remove('notes', body.id); break;
        default: return json({ ok: false, error: 'unknown action' });
      }
    } finally { lock.releaseLock(); }
    return json({ ok: true, events: readAll('events'), notes: readAll('notes') });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function checkPin(pin) {
  const real = PropertiesService.getScriptProperties().getProperty('PIN');
  return !!real && String(pin || '') === String(real);
}
function uid() { return Utilities.getUuid().slice(0, 8); }
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, (c) => (c === '\n' ? c : '')).slice(0, max); }

// ---------------- таблица
function sheet(kind) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const def = SHEETS[kind];
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@'); // всё как текст, чтобы даты не превращались
  }
  return sh;
}
function readAll(kind) {
  const sh = sheet(kind), cols = SHEETS[kind].cols;
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cols.length).getDisplayValues()
    .filter((r) => r[0])
    .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}
function append(kind, obj) {
  sheet(kind).appendRow(SHEETS[kind].cols.map((c) => obj[c] == null ? '' : String(obj[c])));
}
function findRow(kind, id) {
  const sh = sheet(kind), n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sh.getRange(2, 1, n, 1).getDisplayValues().map((r) => r[0]);
  const i = ids.indexOf(String(id));
  return i < 0 ? -1 : i + 2;
}
function remove(kind, id) { const r = findRow(kind, id); if (r > 0) sheet(kind).deleteRow(r); }
function update(kind, id, patch) {
  const r = findRow(kind, id); if (r < 0) return;
  const cols = SHEETS[kind].cols, sh = sheet(kind);
  const row = sh.getRange(r, 1, 1, cols.length).getDisplayValues()[0];
  cols.forEach((c, i) => { if (patch[c] != null) row[i] = String(patch[c]); });
  sh.getRange(r, 1, 1, cols.length).setValues([row]);
}

// Запустите один раз вручную из редактора, чтобы выдать разрешения и проверить работу
function test() {
  sheet('events'); sheet('notes');
  Logger.log('Готово: листы «События» и «Заметки» на месте. PIN задан: ' + !!PropertiesService.getScriptProperties().getProperty('PIN'));
}
