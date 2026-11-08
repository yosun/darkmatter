import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveAccess } from './live-access.mjs';

test('production live calls require access even if no token was provisioned', () => {
  const access = createLiveAccess({ NODE_ENV: 'production' });
  assert.equal(access.required, true); assert.equal(access.authorized({ headers: {} }), false); assert.equal(access.unlock('anything'), null);
});
test('a demo access key creates a secure scoped cookie and tampering is rejected', () => {
  const access = createLiveAccess({ NODE_ENV: 'production', DARKMATTER_LIVE_ACCESS_TOKEN: 'fixture-demo-access-key' });
  assert.equal(access.unlock('wrong'), null);
  const cookie = access.unlock('fixture-demo-access-key');
  assert.match(cookie, /HttpOnly; SameSite=Strict/); assert.match(cookie, /; Secure/);
  assert.doesNotMatch(cookie, /fixture-demo-access-key/);
  assert.equal(access.authorized({ headers: { cookie } }), true);
  assert.equal(access.authorized({ headers: { cookie: cookie.replace('darkmatter_live=', 'darkmatter_live=9') } }), false);
  assert.equal(createLiveAccess({ NODE_ENV: 'production', DARKMATTER_LIVE_ACCESS_TOKEN: 'rotated-key' }).authorized({ headers: { cookie } }), false);
});
test('loopback development does not need a production demo key', () => {
  assert.equal(createLiveAccess({ NODE_ENV: 'development' }).authorized({ headers: {} }), true);
});
