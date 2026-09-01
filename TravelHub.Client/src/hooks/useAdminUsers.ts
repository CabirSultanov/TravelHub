import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AuthUser } from '../types';
import { getErrorMessage } from '../utils/errors';

type UseAdminUsersOptions = {
  active: boolean;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
};

const REGULAR_USERS_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

export function useAdminUsers({ active, setMessage, setSubmitting }: UseAdminUsersOptions) {
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AuthUser[]>([]);
  const [regularUsersTotalItems, setRegularUsersTotalItems] = useState(0);
  const [regularUsersLoading, setRegularUsersLoading] = useState(false);
  const [regularUsersSearch, setRegularUsersSearch] = useState('');
  const [debouncedRegularUsersSearch, setDebouncedRegularUsersSearch] = useState('');
  const regularUsersRequestId = useRef(0);

  useEffect(() => {
    if (!active) return;

    void loadAdmins().catch((error) => setMessage(getErrorMessage(error)));
  }, [active, setMessage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedRegularUsersSearch(regularUsersSearch.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [regularUsersSearch]);

  async function loadAdmins() {
    setAdmins(await api.getAdmins());
  }

  async function loadRegularUsers(search = debouncedRegularUsersSearch) {
    const requestId = ++regularUsersRequestId.current;
    setRegularUsersLoading(true);

    try {
      const response = await api.getAdminCandidates(search, 1, REGULAR_USERS_PAGE_SIZE);

      if (requestId !== regularUsersRequestId.current) {
        return;
      }

      setAdminCandidates(response.items);
      setRegularUsersTotalItems(response.totalItems);
    } catch (error) {
      if (requestId === regularUsersRequestId.current) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      if (requestId === regularUsersRequestId.current) {
        setRegularUsersLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!active) return;

    void loadRegularUsers(debouncedRegularUsersSearch);

    return () => {
      regularUsersRequestId.current += 1;
    };
  }, [active, debouncedRegularUsersSearch]);

  async function refreshAdminData() {
    await Promise.all([loadAdmins(), loadRegularUsers()]);
  }

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    admins,
    adminCandidates,
    regularUsersTotalItems,
    regularUsersLoading,
    regularUsersSearch,
    setRegularUsersSearch,
    promote: (userId: number) => run(async () => {
      await api.promoteUserToAdmin(userId);
      await refreshAdminData();
      setMessage('User promoted to admin.');
    }),
    demote: (userId: number) => run(async () => {
      await api.demoteAdminToUser(userId);
      await refreshAdminData();
      setMessage('Admin demoted to user.');
    }),
    block: (userId: number) => run(async () => {
      await api.blockUser(userId);
      await refreshAdminData();
      setMessage('User blocked.');
    }),
    unblock: (userId: number) => run(async () => {
      await api.unblockUser(userId);
      await refreshAdminData();
      setMessage('User unblocked.');
    }),
    remove: (userId: number) => run(async () => {
      await api.deleteAccount(userId);
      await refreshAdminData();
      setMessage('Account deleted.');
    }),
  };
}
