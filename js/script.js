'use strict';

const STORE_REQUESTS = 'pressf5_requests';
const STORE_ADMIN = 'pressf5_admin';
const STORE_LAST = 'pressf5_last_request';
const STATUSES = ['новая', 'в работе', 'закрыта'];
const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'admin123';
const RESEND_DELAY = 60000;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function readRequests() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_REQUESTS) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function writeRequests(list) {
  localStorage.setItem(STORE_REQUESTS, JSON.stringify(list));
}

function notify(elementId, text, isError = false) {
  const node = document.getElementById(elementId);
  if (!node) return;
  node.textContent = text;
  node.className = 'feedback ' + (isError ? 'error' : 'success');
}

function submitRequest(event) {
  if (event) event.preventDefault();
  const form = document.getElementById('request-form');
  if (!form) return false;

  const name = form.elements['name'].value.trim();
  const contact = form.elements['contact'].value.trim();
  const task = form.elements['task'].value.trim();
  const accepted = form.elements['consent'].checked;

  if (name.length < 2) {
    notify('request-feedback', 'Укажите имя (не менее 2 символов).', true);
    return false;
  }
  if (contact.length < 5 || (!contact.includes('@') && !contact.includes('+'))) {
    notify('request-feedback', 'Укажите контакт: не менее 5 символов, с @ или +.', true);
    return false;
  }
  if (task.length < 10) {
    notify('request-feedback', 'Опишите задачу (не менее 10 символов).', true);
    return false;
  }
  if (!accepted) {
    notify('request-feedback', 'Необходимо согласие на обработку персональных данных.', true);
    return false;
  }

  const now = Date.now();
  const last = Number(localStorage.getItem(STORE_LAST) || 0);
  if (last > 0 && now - last < RESEND_DELAY) {
    notify('request-feedback', 'Попробуйте позже: повторная заявка возможна через 60 секунд.', true);
    return false;
  }

  try {
    const list = readRequests();
    const id = list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    list.push({
      id,
      name,
      contact,
      task,
      status: 'новая',
      date: new Date(now).toLocaleString('ru-RU')
    });
    writeRequests(list);
    localStorage.setItem(STORE_LAST, String(now));
    form.reset();
    notify('request-feedback', 'Заявка сохранена в этом браузере. Спасибо!');
  } catch (_) {
    notify('request-feedback', 'Не удалось сохранить заявку. Проверьте настройки браузера.', true);
  }
  return false;
}

function adminLogin(event) {
  if (event) event.preventDefault();
  const login = document.getElementById('admin-login').value.trim();
  const password = document.getElementById('admin-password').value;

  if (login !== ADMIN_LOGIN || password !== ADMIN_PASSWORD) {
    notify('login-feedback', 'Неверный логин или пароль.', true);
    return false;
  }
  sessionStorage.setItem(STORE_ADMIN, 'true');
  document.getElementById('admin-password').value = '';
  syncAdminView();
  return false;
}

function adminLogout() {
  sessionStorage.removeItem(STORE_ADMIN);
  const form = document.getElementById('login-form');
  if (form) form.reset();
  notify('login-feedback', 'Вы вышли из демонстрационной панели.');
  syncAdminView();
}

function isAdmin() {
  return sessionStorage.getItem(STORE_ADMIN) === 'true';
}

function syncAdminView() {
  const loginArea = document.getElementById('login-area');
  const panel = document.getElementById('admin-panel');
  if (!loginArea || !panel) return;
  loginArea.hidden = isAdmin();
  panel.hidden = !isAdmin();
  if (isAdmin()) renderRequests();
}

function changeStatus(id, status) {
  if (!isAdmin() || !STATUSES.includes(status)) return;
  const list = readRequests();
  const item = list.find(req => Number(req.id) === Number(id));
  if (!item) return;
  item.status = status;
  try {
    writeRequests(list);
    renderRequests();
  } catch (_) {
    notify('admin-feedback', 'Не удалось изменить статус.', true);
  }
}

function renderRequests() {
  if (!isAdmin()) return;
  const tbody = document.getElementById('requests-body');
  const empty = document.getElementById('empty-requests');
  if (!tbody || !empty) return;

  const filter = document.getElementById('status-filter').value;
  const query = document.getElementById('name-search').value.trim().toLocaleLowerCase('ru-RU');
  const all = readRequests();
  const visible = all.filter(item =>
    (filter === 'все' || item.status === filter) &&
    String(item.name || '').toLocaleLowerCase('ru-RU').includes(query)
  );

  tbody.innerHTML = '';
  empty.hidden = visible.length > 0;

  if (!visible.length) {
    empty.textContent = all.length === 0 ? 'Заявок пока нет' : 'По заданным условиям заявок нет';
    return;
  }

  visible.forEach(item => {
    const status = STATUSES.includes(item.status) ? item.status : 'новая';
    const statusClass = status === 'в работе' ? 'work' : status === 'закрыта' ? 'closed' : '';
    const row = document.createElement('tr');
    row.innerHTML =
      `<td>${escapeHtml(item.id)}</td>` +
      `<td>${escapeHtml(item.name || '')}</td>` +
      `<td>${escapeHtml(item.contact || '')}</td>` +
      `<td>${escapeHtml(item.task || '')}</td>` +
      `<td>${escapeHtml(item.date || '')}</td>` +
      `<td><span class="status ${statusClass}">${escapeHtml(status)}</span></td>` +
      '<td><div class="actions"></div></td>';

    const actions = row.querySelector('.actions');
    if (status === 'новая') {
      const take = document.createElement('button');
      take.className = 'btn btn--sm';
      take.textContent = 'Взять в работу';
      take.addEventListener('click', () => changeStatus(item.id, 'в работе'));
      actions.appendChild(take);
    }
    if (status !== 'закрыта') {
      const close = document.createElement('button');
      close.className = 'btn btn--sm btn--ghost';
      close.textContent = 'Закрыть';
      close.addEventListener('click', () => changeStatus(item.id, 'закрыта'));
      actions.appendChild(close);
    }
    if (status === 'закрыта') actions.textContent = '—';

    tbody.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('request-form');
  if (form) form.addEventListener('submit', submitRequest);

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', adminLogin);
    document.getElementById('admin-logout').addEventListener('click', adminLogout);
    document.getElementById('status-filter').addEventListener('change', renderRequests);
    document.getElementById('name-search').addEventListener('input', renderRequests);
    syncAdminView();
  }
});
