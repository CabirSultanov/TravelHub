import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthUser } from '../types';
import { getErrorMessage } from '../utils/errors';

type UseAdminUsersOptions = {
  active: boolean;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
};

export function useAdminUsers({ active, setMessage, setSubmitting }: UseAdminUsersOptions) {
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AuthUser[]>([]);

  useEffect(() => {
    if (!active) return;

    void Promise.all([api.getAdmins(), api.getAdminCandidates()])
      .then(([adminsData, candidatesData]) => {
        setAdmins(adminsData);
        setAdminCandidates(candidatesData);
      })
      .catch((error) => setMessage(getErrorMessage(error)));
  }, [active]);

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
    promote: (userId: number) => run(async () => {
      const admin = await api.promoteUserToAdmin(userId);
      setAdminCandidates((users) => users.filter((user) => user.id !== userId));
      setAdmins((users) => [...users, admin]);
      setMessage('User promoted to admin.');
    }),
    demote: (userId: number) => run(async () => {
      await api.demoteAdminToUser(userId);
      setAdmins((users) => {
        const admin = users.find((user) => user.id === userId);
        if (admin) setAdminCandidates((candidates) => [...candidates, { ...admin, role: 'User' }]);
        return users.filter((user) => user.id !== userId);
      });
      setMessage('Admin demoted to user.');
    }),
    block: (userId: number) => run(async () => {
      const user = await api.blockUser(userId);
      setAdmins((users) => users.map((item) => (item.id === userId ? user : item)));
      setAdminCandidates((users) => users.map((item) => (item.id === userId ? user : item)));
      setMessage('User blocked.');
    }),
    unblock: (userId: number) => run(async () => {
      const user = await api.unblockUser(userId);
      setAdmins((users) => users.map((item) => (item.id === userId ? user : item)));
      setAdminCandidates((users) => users.map((item) => (item.id === userId ? user : item)));
      setMessage('User unblocked.');
    }),
    remove: (userId: number) => run(async () => {
      await api.deleteAccount(userId);
      setAdmins((users) => users.filter((user) => user.id !== userId));
      setAdminCandidates((users) => users.filter((user) => user.id !== userId));
      setMessage('Account deleted.');
    }),
  };
}
