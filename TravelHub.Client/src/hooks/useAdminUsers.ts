import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AuthUser } from '../types';
import { getErrorMessage } from '../utils/errors';

export const ADMIN_USERS_PAGE_SIZE = 20;

export function useAdminUsers(active: boolean) {
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    if (!active) return;
    const request = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const [nextAdmins, response] = await Promise.all([
        api.getAdmins(), api.getAdminUsers(query.search.trim(), query.page, ADMIN_USERS_PAGE_SIZE),
      ]);
      if (request !== revision.current) return;
      if (query.page > Math.max(1, response.totalPages)) {
        setQuery((current) => ({ ...current, page: Math.max(1, response.totalPages) }));
        return;
      }
      setAdmins(nextAdmins);
      setUsers(response.items);
      setTotalItems(response.totalItems);
      setTotalPages(response.totalPages);
    } catch (reason) {
      if (request === revision.current) setError(getErrorMessage(reason));
      throw reason;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [active, query]);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => void refresh().catch(() => undefined), 300);
    return () => { window.clearTimeout(timer); revision.current += 1; };
  }, [refresh]);

  function changeQuery(next: typeof query) {
    revision.current += 1;
    setLoading(true);
    setUsers([]);
    setQuery(next);
  }

  return {
    admins, users, ...query, totalItems, totalPages, loading, error, refresh,
    setSearch: (search: string) => changeQuery({ search, page: 1 }),
    setPage: (page: number) => changeQuery({ ...query, page }),
  };
}
