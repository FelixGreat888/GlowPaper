import { requestApi } from './http.js';

export async function getCurrentSession() {
  return requestApi('/api/auth/me');
}

export async function login(payload) {
  return requestApi('/api/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export async function register(payload) {
  return requestApi('/api/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function logout() {
  return requestApi('/api/auth/logout', {
    method: 'POST',
  });
}

export async function fetchAdminUsers() {
  return requestApi('/api/admin/users');
}

export async function updateAdminUserStatus(userId, nextAction) {
  return requestApi(`/api/admin/users/${encodeURIComponent(userId)}/${nextAction}`, {
    method: 'POST',
  });
}

export async function updateAdminUserCredits(userId, balance) {
  return requestApi(`/api/admin/users/${encodeURIComponent(userId)}/credits`, {
    method: 'POST',
    body: { balance },
  });
}

