// Runs before every test file (jest "setupFiles").
// Points the app at a throwaway database so tests never touch your real data.
const os   = require('os');
const path = require('path');

process.env.NODE_ENV            = 'test';
process.env.USE_MOCK_DB         = 'false';
process.env.DB_NAME             = process.env.TEST_DB_NAME || 'jhapto_test';
process.env.DATABASE_URL = '';   // tests always use the local DB_* settings (dotenv won't override this)
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.JWT_SECRET          = 'jhapto-test-secret';
process.env.UPLOAD_DIR          = path.join(os.tmpdir(), 'jhapto-test-uploads');

if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(`Refusing to run tests against "${process.env.DB_NAME}" — the name must end in _test.`);
}

// Never call the real Claude API from tests (moderation.test.js uses a fake client)
process.env.AI_MODERATION = 'off';
