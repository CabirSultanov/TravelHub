const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'sort' });

export function getOwnerLabel(ownerId: number | null | undefined, users: { id: number; name: string }[]) {
  if (ownerId == null) return 'No owner assigned';
  return users.find((user) => user.id === ownerId)?.name ?? `Owner #${ownerId} · details unavailable`;
}

export function matchesOwnerFilter(ownerId: number | null | undefined, filter: 'all' | 'with' | 'without') {
  return filter === 'all' || (filter === 'with' ? ownerId != null : ownerId == null);
}

export function filterAndSortAdminResources<T>(
  resources: T[],
  search: string,
  searchValues: (resource: T) => string[],
  sortValue: (resource: T) => string,
) {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return [...resources]
    .filter((resource) => normalizedSearch.length === 0 || searchValues(resource)
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
    .sort((left, right) => collator.compare(sortValue(left), sortValue(right)));
}
