import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthUser } from '../types';
import { getErrorMessage } from '../utils/errors';

type UseAdminUsersOptions = {
  active: boolean;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
};

const REGULAR_USERS_PAGE_SIZE = 10;

export function useAdminUsers({ active, setMessage, setSubmitting }: UseAdminUsersOptions) {
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AuthUser[]>([]);
  const [regularUsersPage, setRegularUsersPage] = useState(1);
  const [regularUsersTotalItems, setRegularUsersTotalItems] = useState(0);
  const [regularUsersTotalPages, setRegularUsersTotalPages] = useState(0);
  const [regularUsersLoading, setRegularUsersLoading] = useState(false);

  useEffect(() => {
    if (!active) return;

    void loadAdmins().catch((error) => setMessage(getErrorMessage(error)));
  }, [active, setMessage]);

  useEffect(() => {
    if (!active) return;

    let ignore = false;
    setRegularUsersLoading(true);

    void api
      .getAdminCandidates(regularUsersPage, REGULAR_USERS_PAGE_SIZE)
      .then((response) => {
        if (ignore) {
          return;
        }

        setAdminCandidates(response.items);
        setRegularUsersPage(response.page);
        setRegularUsersTotalItems(response.totalItems);
        setRegularUsersTotalPages(response.totalPages);
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!ignore) {
          setRegularUsersLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [active, regularUsersPage, setMessage]);

  async function loadAdmins() {
    setAdmins(await api.getAdmins());
  }

  async function loadRegularUsers(page = regularUsersPage) {
    setRegularUsersLoading(true);

    try {
      const response = await api.getAdminCandidates(page, REGULAR_USERS_PAGE_SIZE);
      setAdminCandidates(response.items);
      setRegularUsersPage(response.page);
      setRegularUsersTotalItems(response.totalItems);
      setRegularUsersTotalPages(response.totalPages);
    } finally {
      setRegularUsersLoading(false);
    }
  }

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
    regularUsersPage,
    regularUsersTotalItems,
    regularUsersTotalPages,
    regularUsersLoading,
    setRegularUsersPage,
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
