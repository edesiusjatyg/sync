// Reusable mock data for auth session
export function createMockSessionUser(overrides: Partial<{ id: string; email: string; name: string; role: 'student' | 'admin'; hasCompletedOnboarding: boolean }> = {}) {
  return {
    id: 'mock-user-id',
    email: 'mock@test.com',
    name: 'Mock User',
    role: 'student' as const,
    hasCompletedOnboarding: true,
    ...overrides,
  };
}

export function createMockSession(userOverrides: Parameters<typeof createMockSessionUser>[0] = {}) {
  return {
    user: createMockSessionUser(userOverrides),
    expires: '9999-12-31T23:59:59.999Z',
  };
}
