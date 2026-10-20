// PLACEHOLDER: verify. The mock API has no locations endpoint yet; replace with the API's list
// when it exists. Names are illustrative only.
export interface SearchLocation {
  id: string;
  name: string;
}

export const PLACEHOLDER_LOCATIONS: readonly SearchLocation[] = [
  { id: 'main-clubhouse', name: 'Main Clubhouse' },
  { id: 'north-lodge', name: 'North Lodge' },
  { id: 'lakeside', name: 'Lakeside Cottages' },
];
