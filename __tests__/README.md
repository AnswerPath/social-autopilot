# Authentication & Authorization Test Suite

This directory contains comprehensive tests for the authentication and role management system.

## Test Structure

```
__tests__/
├── auth/
│   ├── auth-utils.test.ts          # Unit tests for core auth utilities
│   ├── api-routes.test.ts          # Integration tests for auth API routes
│   ├── permission-middleware.test.ts # Tests for permission middleware
│   ├── use-auth.test.tsx           # Tests for useAuth React hook
│   └── activity-logging.test.ts    # Tests for activity logging system
├── integration/
│   ├── api-routes.test.ts          # General API route tests
│   └── hybrid-service.test.ts      # Hybrid service integration tests
└── utils/
    └── test-utils.ts               # Shared testing utilities
```

## Test Coverage

### Authentication Utilities (`auth-utils.test.ts`)
- **Password Hashing**: Secure hashing, uniqueness, edge cases
- **Password Verification**: Correct/incorrect passwords, case sensitivity
- **Session Token Management**: Token generation, verification, expiration
- **Permission System**: Permission retrieval, role-based permissions
- **Permission Checking**: Single and multiple permission validation
- **Role Checking**: Role identification and comparison
- **Security Edge Cases**: Null handling, injection attempts

### API Routes (`api-routes.test.ts`)
- **Registration**: Successful registration, validation, profile creation
- **Login**: Valid/invalid credentials, session creation, logging
- **Logout**: Session cleanup, cookie clearing
- **Session Management**: Session retrieval, token refresh
- **Security Features**: Rate limiting, CSRF protection, input sanitization

### Permission Middleware (`permission-middleware.test.ts`)
- **Authentication Middleware**: Token validation, cookie parsing
- **Permission Middleware**: Permission-based access control
- **Role Middleware**: Role-based access control
- **Middleware Chaining**: Combined auth and permission checks
- **Edge Cases**: Missing cookies, malformed tokens, null values
- **Performance**: Efficient validation, caching

### useAuth Hook (`use-auth.test.tsx`)
- **Authentication State**: Initial state, session fetching
- **Login/Logout**: Successful/failed operations, loading states
- **Registration**: New user creation, error handling
- **Permission Checking**: Runtime permission validation
- **Session Refresh**: Automatic token refresh, logout on failure
- **Error Handling**: Network errors, malformed responses

### Activity Logging (`activity-logging.test.ts`)
- **Log Activity**: Various activity types, metadata handling
- **Get Activity Logs**: Filtering, date ranges, pagination
- **Export Logs**: JSON and CSV export formats
- **Cleanup**: Old log deletion, retention periods
- **Compliance**: GDPR/CCPA compliance, security events
- **Security**: No sensitive data in logs

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test auth-utils
npm test api-routes
npm test permission-middleware
npm test use-auth
npm test activity-logging
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### CI Mode
```bash
npm run test:ci
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- **Environment**: jsdom for React components
- **Setup**: Mocks for Next.js router, navigation, and fetch
- **Coverage Thresholds**: 70% for branches, functions, lines, statements

### Jest Setup (`jest.setup.js`)
- Mocks for Next.js router and navigation
- Global fetch mock
- Environment variable mocks
- Console method mocks for cleaner test output

## Testing Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow AAA pattern: Arrange, Act, Assert

### 2. Mocking
- Mock external dependencies (Supabase, fetch, etc.)
- Reset mocks between tests using `beforeEach`
- Use realistic mock data

### 3. Assertions
- Test both success and failure scenarios
- Verify error messages and error handling
- Check edge cases and boundary conditions

### 4. Coverage Goals
- Aim for >80% code coverage
- Focus on critical authentication and authorization paths
- Test security-sensitive code thoroughly

### 5. Security Testing
- Test authentication bypass attempts
- Verify permission enforcement
- Check for injection vulnerabilities
- Test rate limiting and CSRF protection

## Test Data Factories

Use the test utilities from `__tests__/utils/test-utils.ts`:

```typescript
import {
  createTestUser,
  createTestCredentials,
  mockFetch,
  expectToastSuccess,
} from '@/__tests__/utils/test-utils'

const user = createTestUser({ role: 'ADMIN' })
const mockResponse = mockFetch({ success: true, data: user })
```

## Continuous Integration

Tests are automatically run on:
- Pull request creation
- Push to main branch
- Pre-commit hooks (optional)

CI configuration ensures:
- All tests pass
- Coverage thresholds are met
- No linting errors
- No type errors

## Troubleshooting

### Common Issues

**Issue**: Tests timeout
**Solution**: Increase timeout in `jest.config.js` or use `jest.setTimeout(10000)`

**Issue**: Mocks not working
**Solution**: Ensure mocks are defined before imports, check mock paths

**Issue**: React hooks error
**Solution**: Wrap hook tests in `renderHook` with proper wrapper

**Issue**: Async tests failing
**Solution**: Use `await` with `waitFor`, check for race conditions

### Debug Mode

Run tests with verbose output:
```bash
npm test -- --verbose
```

Run tests with debugging:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Future Test Additions

- [ ] End-to-end tests with Playwright or Cypress
- [ ] Load testing for authentication endpoints
- [ ] Security penetration testing
- [ ] Visual regression testing for auth UI
- [ ] Performance benchmarking
- [ ] Accessibility testing for auth forms

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure tests cover success and failure cases
3. Update this README with new test descriptions
4. Maintain coverage thresholds
5. Run full test suite before committing

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Next.js Testing](https://nextjs.org/docs/testing)
