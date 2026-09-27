import { describe, expect, it } from 'vitest';
import { filterAndSortAdminResources } from './adminListUtils';

type Resource = {
  id: number;
  name: string;
  city: string;
};

const resources: Resource[] = [
  { id: 1, name: 'Gabala Garden Hotel', city: 'Gabala' },
  { id: 2, name: 'Baku Sea View Hotel', city: 'Baku' },
  { id: 3, name: 'Baki Plaza', city: 'Baki' },
];

function filter(search: string) {
  return filterAndSortAdminResources(resources, search, (resource) => [resource.name, resource.city], (resource) => resource.name);
}

describe('filterAndSortAdminResources', () => {
  it('sorts resources alphabetically without changing the original list', () => {
    expect(filter('').map((resource) => resource.name)).toEqual([
      'Baki Plaza',
      'Baku Sea View Hotel',
      'Gabala Garden Hotel',
    ]);
    expect(resources[0].name).toBe('Gabala Garden Hotel');
  });

  it('filters by resource name with trimmed case-insensitive search', () => {
    expect(filter('  GARDEN ').map((resource) => resource.id)).toEqual([1]);
  });

  it('filters by city', () => {
    expect(filter('baku').map((resource) => resource.id)).toEqual([2]);
  });

  it('filters and sorts taxi services by company name and city', () => {
    const taxis = [
      { id: 1, companyName: 'Zebra Taxi', city: 'Baku' },
      { id: 2, companyName: 'Airport Cars', city: 'Gabala' },
      { id: 3, companyName: 'City Ride', city: 'Baku' },
    ];

    const filtered = filterAndSortAdminResources(
      taxis,
      '  BAKU ',
      (taxi) => [taxi.companyName, taxi.city],
      (taxi) => taxi.companyName,
    );

    expect(filtered.map((taxi) => taxi.companyName)).toEqual(['City Ride', 'Zebra Taxi']);
  });
});
