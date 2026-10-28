// Employee types are changed by administrators only: the same rule as every page that holds
// secrets (API Integrations, ticket 188), so both use one hook.
export { useAdminOnlyReadOnly as useEmployeesReadOnly } from './useAdminOnlyReadOnly';
