import type { IntegrationProvider, PayCloudEnvironment } from './types';

// PLACEHOLDER sample data until the backend exists (see entries/188-api-integrations.md). The
// secrets below are invented and live only inside the mock; the API returns them masked.
export interface StoredApiKey {
  id: string;
  name: string;
  secret: string;
  createdAt: string;
}
export interface StoredPayCloudToken {
  id: string;
  apiKey: string;
  environment: PayCloudEnvironment;
}
export interface StoredAuth {
  provider: IntegrationProvider;
  enabled: boolean;
  baseUrl: string;
  userName: string;
  password: string;
  accessId: string;
  uuid: string;
}

export function mockStoredApiKeys(today: string): StoredApiKey[] {
  return [
    {
      id: 'key-1',
      name: 'Website booking widget',
      secret: 'grk_demo0booking0widget0placeholder0aaaa1111',
      createdAt: today,
    },
    {
      id: 'key-2',
      name: 'Accounting export',
      secret: 'grk_demo0accounting0export0placeholder0bbbb2222',
      createdAt: today,
    },
  ];
}

export const mockStoredPayCloudTokens = (): StoredPayCloudToken[] => [
  { id: 'paycloud-1', apiKey: '3f2b8c1e-5d4a-4e7b-9a60-1c2d3e4f5a6b', environment: 'production' },
  { id: 'paycloud-2', apiKey: '7a9d0e12-6b3c-4f85-8d21-0e9f8a7b6c5d', environment: 'test' },
];

export const mockStoredAuths = (): StoredAuth[] => [
  {
    provider: 'tiger-tms',
    enabled: false,
    baseUrl: '',
    userName: '',
    password: '',
    accessId: '',
    uuid: '',
  },
  {
    provider: 'assa-abloy',
    enabled: false,
    baseUrl: '',
    userName: '',
    password: '',
    accessId: '',
    uuid: '',
  },
];
