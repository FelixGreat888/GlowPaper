import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminUsers,
  getCurrentSession,
  logout,
  updateAdminUserCredits,
  updateAdminUserStatus,
} from '../src-v2/lib/auth.js';

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toReadableError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return '请求失败，请稍后重试';
}

export default function AdminApp() {
  const [authStatus, setAuthStatus] = useState('loading');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [draftBalances, setDraftBalances] = useState({});
  const [pageError, setPageError] = useState('');
  const [actionState, setActionState] = useState('');

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === 'admin' ? -1 : 1;
      }

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [users]);

  async function loadUsers() {
    const payload = await fetchAdminUsers();
    const nextUsers = payload?.users || [];
    setUsers(nextUsers);
    setDraftBalances(
      Object.fromEntries(nextUsers.map((user) => [user.id, String(user.creditBalance ?? 0)])),
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await getCurrentSession();
        if (cancelled) {
          return;
        }

        if (!session?.authenticated || !session?.user) {
          setAuthStatus('guest');
          return;
        }

        if (session.user.role !== 'admin') {
          setCurrentUser(session.user);
          setAuthStatus('forbidden');
          return;
        }

        setCurrentUser(session.user);
        setAuthStatus('ready');
        await loadUsers();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPageError(toReadableError(error));
        setAuthStatus('error');
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStatusChange(user, nextAction) {
    const loadingKey = `${nextAction}:${user.id}`;
    setActionState(loadingKey);
    setPageError('');

    try {
      const payload = await updateAdminUserStatus(user.id, nextAction);
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? payload.user : item)),
      );
      setDraftBalances((prev) => ({
        ...prev,
        [user.id]: String(payload.user.creditBalance ?? 0),
      }));
    } catch (error) {
      setPageError(toReadableError(error));
    } finally {
      setActionState('');
    }
  }

  async function handleBalanceSave(userId) {
    const loadingKey = `credit:${userId}`;
    setActionState(loadingKey);
    setPageError('');

    try {
      const payload = await updateAdminUserCredits(userId, Number(draftBalances[userId] || 0));
      setUsers((prev) => prev.map((item) => (item.id === userId ? payload.user : item)));
      setDraftBalances((prev) => ({
        ...prev,
        [userId]: String(payload.user.creditBalance ?? 0),
      }));
    } catch (error) {
      setPageError(toReadableError(error));
    } finally {
      setActionState('');
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Ignore logout failures.
    }

    window.location.href = '/';
  }

  return (
    <div className="admin-root">
      <div className="admin-noise" aria-hidden="true" />
      <header className="admin-header">
        <div className="admin-brand">
          <img src="/logo.png" alt="" aria-hidden="true" />
          <div>
            <strong>流光SVG 管理后台</strong>
            <span>用户、账号状态与算粒余额维护</span>
          </div>
        </div>

        <div className="admin-header-actions">
          {currentUser ? <span className="admin-user-chip">{currentUser.email}</span> : null}
          <a className="admin-link" href="/">返回首页</a>
          <button type="button" className="admin-button ghost" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <main className="admin-main">
        {authStatus === 'loading' ? <div className="admin-state">正在加载后台权限...</div> : null}

        {authStatus === 'guest' ? (
          <div className="admin-state card">
            <h1>请先登录管理员账号</h1>
            <p>当前后台只对管理员开放。请先回到首页登录，再重新打开本页。</p>
            <a className="admin-button" href="/">去首页登录</a>
          </div>
        ) : null}

        {authStatus === 'forbidden' ? (
          <div className="admin-state card">
            <h1>你当前没有后台权限</h1>
            <p>当前账号已登录，但不是管理员账号，不能查看用户和算粒设置。</p>
          </div>
        ) : null}

        {authStatus === 'error' ? (
          <div className="admin-state card">
            <h1>后台加载失败</h1>
            <p>{pageError || '请稍后重试。'}</p>
          </div>
        ) : null}

        {authStatus === 'ready' ? (
          <>
            <section className="admin-overview">
              <article>
                <span>用户总数</span>
                <strong>{users.length}</strong>
              </article>
              <article>
                <span>管理员</span>
                <strong>{users.filter((user) => user.role === 'admin').length}</strong>
              </article>
              <article>
                <span>停用账号</span>
                <strong>{users.filter((user) => user.status !== 'active').length}</strong>
              </article>
            </section>

            {pageError ? <div className="admin-page-error">{pageError}</div> : null}

            <section className="admin-table-card">
              <div className="admin-table-head">
                <div>
                  <h1>用户列表</h1>
                  <p>可以停用账号，也可以直接设置算粒余额。</p>
                </div>
                <button type="button" className="admin-button ghost" onClick={() => void loadUsers()}>
                  刷新列表
                </button>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>邮箱</th>
                      <th>角色</th>
                      <th>状态</th>
                      <th>算粒余额</th>
                      <th>注册时间</th>
                      <th>最近登录</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="email-cell">{user.email}</td>
                        <td>{user.role === 'admin' ? '管理员' : '普通用户'}</td>
                        <td>
                          <span className={`status-badge ${user.status === 'active' ? 'active' : 'disabled'}`}>
                            {user.status === 'active' ? '正常' : '已停用'}
                          </span>
                        </td>
                        <td>
                          <div className="credit-editor">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draftBalances[user.id] ?? ''}
                              onChange={(event) =>
                                setDraftBalances((prev) => ({
                                  ...prev,
                                  [user.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="admin-button mini"
                              disabled={actionState === `credit:${user.id}`}
                              onClick={() => void handleBalanceSave(user.id)}
                            >
                              保存
                            </button>
                          </div>
                        </td>
                        <td>{formatDateTime(user.createdAt)}</td>
                        <td>{formatDateTime(user.lastLoginAt)}</td>
                        <td>
                          {user.status === 'active' ? (
                            <button
                              type="button"
                              className="admin-button danger mini"
                              disabled={actionState === `disable:${user.id}`}
                              onClick={() => void handleStatusChange(user, 'disable')}
                            >
                              停用
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-button mini"
                              disabled={actionState === `enable:${user.id}`}
                              onClick={() => void handleStatusChange(user, 'enable')}
                            >
                              恢复
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
