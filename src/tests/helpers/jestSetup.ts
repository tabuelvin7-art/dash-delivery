// Set test environment variables before any module is loaded
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-secret-key-for-jest';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-for-jest';
