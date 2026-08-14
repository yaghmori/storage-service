import {
  remainingTtlSeconds,
  parseFileDownloadPath,
  signFileDownload,
  verifyFileDownloadHmac,
} from './file-download-hmac';

const SECRET = 'test-signing-secret-at-least-32-chars!!';
const FILE_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('file-download-hmac', () => {
  it('signs and verifies a download URL payload', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signFileDownload({ fileId: FILE_ID, exp }, SECRET);
    expect(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, sig, SECRET),
    ).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signFileDownload({ fileId: FILE_ID, exp }, SECRET);
    expect(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, `${sig}x`, SECRET),
    ).toBe(false);
  });

  it('rejects an expired signature', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const sig = signFileDownload({ fileId: FILE_ID, exp }, SECRET);
    expect(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, sig, SECRET),
    ).toBe(false);
  });

  it('binds the variant into the signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signFileDownload(
      { fileId: FILE_ID, exp, variant: 'thumbnail' },
      SECRET,
    );
    expect(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, sig, SECRET),
    ).toBe(false);
    expect(
      verifyFileDownloadHmac(
        { fileId: FILE_ID, exp, variant: 'thumbnail' },
        sig,
        SECRET,
      ),
    ).toBe(true);
  });

  it('parses versioned and unversioned download paths', () => {
    expect(parseFileDownloadPath(`/v1/files/${FILE_ID}/download`)).toBe(
      FILE_ID,
    );
    expect(parseFileDownloadPath(`/files/${FILE_ID}/download`)).toBe(FILE_ID);
    expect(parseFileDownloadPath('/v1/files/not-a-uuid/download')).toBe(
      undefined,
    );
  });

  it('computes remaining TTL', () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(remainingTtlSeconds(exp)).toBeGreaterThan(100);
    expect(remainingTtlSeconds(exp)).toBeLessThanOrEqual(120);
  });
});
