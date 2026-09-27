import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { api } from '../../api';
import type { AuthUser, Hotel } from '../../types';
import { loadAllAdminHotels } from '../../hooks/useOwnerAssignments';
import { saveAndRefresh } from '../../hooks/useSavedAction';
import { ADMIN_USERS_PAGE_SIZE } from '../../hooks/useAdminUsers';
import { getOwnerLabel, matchesOwnerFilter, filterAndSortAdminResources } from './adminListUtils';
import { getAdminUserActions } from './AdminUsersPanel';
import AdminPage from './AdminPage';
import OwnerAssignmentPanel from './OwnerAssignmentPanel';
import TaxiDriversPanel from '../../features/taxi/components/TaxiDriversPanel';
import type { TaxiDriverManagement } from '../../features/taxi/taxi.types';

const person = (overrides: Partial<AuthUser> = {}): AuthUser => ({ id: 1, name: 'Test Person', email: 'test@example.test', phoneNumber: '+994 500000000', role: 'User', isBlocked: false, ...overrides });
afterEach(() => vi.restoreAllMocks());

describe('admin ownership lists', () => {
  it('distinguishes an unavailable owner from no owner', () => {
    expect(getOwnerLabel(null, [])).toBe('No owner assigned');
    expect(getOwnerLabel(42, [])).toContain('details unavailable');
    expect(getOwnerLabel(1, [person()])).toBe('Test Person');
    expect(matchesOwnerFilter(42, 'with')).toBe(true);
    expect(matchesOwnerFilter(42, 'without')).toBe(false);
    expect(matchesOwnerFilter(undefined, 'without')).toBe(true);
  });

  it('loads every hotel page so search includes a hotel beyond the first 100', async () => {
    const first = Array.from({ length: 100 }, (_, id) => ({ id, name: `Hotel ${id}`, city: 'Baku' } as Hotel));
    const last = { id: 101, name: 'Mountain Lodge', city: 'Gabala' } as Hotel;
    const get = vi.spyOn(api, 'getHotels').mockResolvedValueOnce({ items: first, page: 1, pageSize: 100, totalItems: 101, totalPages: 2 })
      .mockResolvedValueOnce({ items: [last], page: 2, pageSize: 100, totalItems: 101, totalPages: 2 });
    const all = await loadAllAdminHotels();
    expect(get).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
    expect(all).toHaveLength(101);
    expect(filterAndSortAdminResources(all, 'gabala', (hotel) => [hotel.name, hotel.city], (hotel) => hotel.name)).toEqual([last]);
  });

  it('does not treat an incomplete hotel load as a complete list', async () => {
    vi.spyOn(api, 'getHotels').mockResolvedValueOnce({ items: [], page: 1, pageSize: 100, totalItems: 101, totalPages: 2 })
      .mockRejectedValueOnce(new Error('Offline'));
    await expect(loadAllAdminHotels()).rejects.toThrow('Offline');
  });
});

describe('save and reload outcomes', () => {
  it('does not refresh or report success after a rejected mutation', async () => {
    const refresh = vi.fn();
    const result = await saveAndRefresh(() => Promise.reject(new Error('A driver with an active ride cannot be removed.')), refresh, 'Removed.');
    expect(result.saved).toBe(false);
    expect(result.feedback).toEqual({ kind: 'error', message: 'A driver with an active ride cannot be removed.' });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('reports a saved change even when refreshing dependencies fails, without resubmitting', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await saveAndRefresh(write, () => Promise.reject(new Error('Offline')), 'Owner saved.');
    expect(result.saved).toBe(true);
    expect(result.feedback.kind).toBe('warning');
    expect(result.feedback.message).toContain('change was saved');
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('waits for reload after the write and then reports success', async () => {
    const calls: string[] = [];
    const result = await saveAndRefresh(async () => { calls.push('write'); }, async () => { calls.push('reload'); }, 'Driver added.');
    expect(calls).toEqual(['write', 'reload']);
    expect(result).toEqual({ saved: true, feedback: { kind: 'success', message: 'Driver added.' } });
  });
});

describe('admin access and existing account actions', () => {
  it('shows business sections to Admin and the additional account section only to SuperAdmin', () => {
    const admin = renderToStaticMarkup(<AdminPage currentUser={person({ role: 'Admin' })} />);
    expect(admin).toContain('Taxi services');
    expect(admin).toContain('Hotels');
    expect(admin).not.toContain('Users &amp; admins');
    expect(renderToStaticMarkup(<AdminPage currentUser={person({ role: 'SuperAdmin' })} />)).toContain('Users &amp; admins');
    expect(renderToStaticMarkup(<AdminPage currentUser={person()} />)).toBe('');
    expect(ADMIN_USERS_PAGE_SIZE).toBe(20);
  });
  it.each(['User', 'Admin'] as const)('only exposes deletion for blocked %s accounts', (role) => {
    expect(getAdminUserActions(person({ role }))).not.toContain('delete');
    expect(getAdminUserActions(person({ role, isBlocked: true }))).toContain('delete');
  });
  it('keeps promotion, demotion and block controls without broadening the catalog', () => {
    expect(getAdminUserActions(person())).toEqual(['promote', 'block']);
    expect(getAdminUserActions(person({ role: 'Admin', isBlocked: true }))).toEqual(['demote', 'unblock', 'delete']);
    for (const role of ['TaxiDriver', 'TaxiOwner', 'HotelOwner', 'SuperAdmin'] as const) expect(getAdminUserActions(person({ role }))).toEqual([]);
  });
  it('starts ownership in a read-only state and never writes just to render candidates', () => {
    const save = vi.fn();
    const html = renderToStaticMarkup(<OwnerAssignmentPanel ownerId={42} candidates={[person()]} objectName="Test Company"
      busy={false} disabled={false} feedback={null} onSave={save} onClear={() => undefined} />);
    expect(html).toContain('Owner details unavailable');
    expect(html).not.toContain('No owner assigned');
    expect(html).not.toContain('Save assignment');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('shared driver panel states', () => {
  function render(overrides: Partial<TaxiDriverManagement> = {}) {
    return renderToStaticMarkup(<TaxiDriversPanel submitting={false} companyName="Test Fleet" management={{
      drivers: [], candidates: [], search: '', setSearch: () => undefined, assign: async () => true, remove: async () => true,
      loading: false, error: '', feedback: null, busy: false, needsRefresh: false, retry: async () => undefined, clearFeedback: () => undefined, ...overrides,
    }} />);
  }
  it('does not disguise a loading or error state as an empty team', () => {
    expect(render({ loading: true })).toContain('Loading drivers');
    expect(render({ loading: true })).not.toContain('No drivers assigned');
    expect(render({ error: 'Offline' })).toContain('Could not load the team');
    expect(render({ error: 'Offline' })).not.toContain('No drivers assigned');
    expect(render()).toContain('No drivers assigned');
  });
  it('shows current drivers first, real phone and blocking state; hides the candidate form initially', () => {
    const html = render({ drivers: [person({ role: 'TaxiDriver', isBlocked: true })], candidates: [person({ id: 2, email: 'candidate@example.test' })] });
    expect(html).toContain('Current drivers');
    expect(html).toContain('+994 500000000');
    expect(html).toContain('Blocked');
    expect(html).not.toContain('candidate@example.test');
  });
});
