/**
 * Artillery processor: logs in before each scenario and sets authCookie for
 * subsequent requests. All scenario requests use the Cookie header so protected
 * endpoints (scheduler, twitter, analytics, scheduled-posts) return real responses.
 *
 * Requires LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD (or dev defaults).
 * Sets userContext.vars.authCookie used by config.defaults.headers["Cookie"].
 */

function getTarget(test) {
  const config = test?.script?.config || test?.config;
  return config?.target || process.env.LOAD_TEST_TARGET || 'http://localhost:3000';
}

function parseCookieHeader(setCookieHeader) {
  if (!setCookieHeader) return '';
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts
    .map((header) => {
      const firstSemi = header.indexOf(';');
      return firstSemi >= 0 ? header.slice(0, firstSemi).trim() : header.trim();
    })
    .filter(Boolean)
    .join('; ');
}

async function beforeScenario(userContext, events, test) {
  const target = getTarget(test);
  const email = process.env.LOAD_TEST_EMAIL || 'demo@socialautopilot.com';
  const password = process.env.LOAD_TEST_PASSWORD || 'demo123456';

  try {
    const res = await fetch(`${target}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      events.emit('counter', 'load_test.auth_failed', 1);
      userContext.vars.authCookie = '';
      return;
    }

    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.raw && res.headers.raw()['set-cookie']) || [res.headers.get('set-cookie')].filter(Boolean);
    const authCookie = parseCookieHeader(setCookies);
    userContext.vars.authCookie = authCookie;
  } catch (err) {
    events.emit('counter', 'load_test.auth_error', 1);
    userContext.vars.authCookie = '';
  }
}

module.exports = { beforeScenario };
