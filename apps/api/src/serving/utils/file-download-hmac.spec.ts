import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
    assert.equal(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, sig, SECRET),
      true,
    );
  });

  it('rejects a tampered signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signFileDownload({ fileId: FILE_ID, exp }, SECRET);
    assert.equal(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, `${sig}x`, SECRET),
      false,
    );
  });

  it('rejects an expired signature', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const sig = signFileDownload({ fileId: FILE_ID, exp }, SECRET);
    assert.equal(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, sig, SECRET),
      false,
    );
  });

  it('binds the variant into the signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signFileDownload(
      { fileId: FILE_ID, exp, variant: 'thumbnail' },
      SECRET,
    );
    assert.equal(
      verifyFileDownloadHmac(
        { fileId: FILE_ID, exp, variant: 'thumbnail' },
        sig,
        SECRET,
      ),
      true,
    );
    assert.equal(
      verifyFileDownloadHmac({ fileId: FILE_ID, exp }, sig, SECRET),
      false,
    );
  });

  it('parses signed download paths', () => {
    const parsed = parseFileDownloadPath(`/files/${FILE_ID}/download`);
    assert.equal(parsed, FILE_ID);
  });

  it('computes remaining TTL', () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    assert.ok(remainingTtlSeconds(exp) > 0);
  });
});
