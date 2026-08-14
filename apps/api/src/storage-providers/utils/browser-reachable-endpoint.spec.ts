import {
  isBrowserReachableS3Endpoint,
  isFilesPublicBaseHost,
} from './browser-reachable-endpoint';

describe('isBrowserReachableS3Endpoint', () => {
  it('treats empty endpoint as AWS default (reachable)', () => {
    expect(isBrowserReachableS3Endpoint(undefined)).toBe(true);
    expect(isBrowserReachableS3Endpoint('')).toBe(true);
  });

  it('accepts public HTTPS S3/R2 endpoints', () => {
    expect(
      isBrowserReachableS3Endpoint(
        'https://de0eae45bc06d98f1dd1898af3c5e9a0.r2.cloudflarestorage.com',
      ),
    ).toBe(true);
    expect(isBrowserReachableS3Endpoint('https://s3.amazonaws.com')).toBe(
      true,
    );
  });

  it('rejects Docker DNS, loopback, and http', () => {
    expect(isBrowserReachableS3Endpoint('http://minio:9000')).toBe(false);
    expect(isBrowserReachableS3Endpoint('minio')).toBe(false);
    expect(isBrowserReachableS3Endpoint('http://127.0.0.1:9000')).toBe(
      false,
    );
    expect(isBrowserReachableS3Endpoint('https://localhost:9000')).toBe(
      false,
    );
  });
});

describe('isFilesPublicBaseHost', () => {
  const previous = process.env.FILES_PUBLIC_BASE_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.FILES_PUBLIC_BASE_URL;
    } else {
      process.env.FILES_PUBLIC_BASE_URL = previous;
    }
  });

  it('detects the app CDN hostname', () => {
    process.env.FILES_PUBLIC_BASE_URL = 'https://cdn.allyfe.org';
    expect(isFilesPublicBaseHost('https://cdn.allyfe.org')).toBe(true);
    expect(
      isFilesPublicBaseHost(
        'https://de0eae45bc06d98f1dd1898af3c5e9a0.r2.cloudflarestorage.com',
      ),
    ).toBe(false);
  });
});
