import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const equal = (a, b) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function createLiveAccess(env = process.env) {
  const key = env.DARKMATTER_LIVE_ACCESS_TOKEN || '';
  const required = env.NODE_ENV === 'production' || Boolean(key);
  const sign = (value) => createHmac('sha256', key).update(value).digest('base64url');
  return {
    required,
    authorized(request) {
      if (!required) return true;
      if (!key) return false;
      const cookie = /(?:^|;\s*)darkmatter_live=([^;]+)/.exec(request.headers.cookie || '')?.[1];
      if (!cookie || cookie.length > 512) return false;
      const [expiry, nonce, signature, extra] = cookie.split('.');
      return !extra && Number(expiry) > Date.now() && Number(expiry) < Date.now() + 25 * 60 * 60 * 1000
        && /^[a-z0-9_-]{16,64}$/i.test(nonce || '') && equal(sign(`${expiry}.${nonce}`), signature || '');
    },
    unlock(token) {
      if (!key || typeof token !== 'string' || !equal(key, token)) return null;
      const value = `${Date.now() + 24 * 60 * 60 * 1000}.${randomBytes(18).toString('base64url')}`;
      return `darkmatter_live=${value}.${sign(value)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=86400${env.NODE_ENV === 'production' || env.DARKMATTER_PUBLIC_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`;
    },
  };
}
