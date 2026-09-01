const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'sort' });

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
