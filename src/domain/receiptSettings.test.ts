import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReceiptKeyword, receiptCompanyName } from './receiptSettings';

test('company name uses the default or trimmed custom keyword', () => {
  assert.equal(receiptCompanyName(), '우리운수');
  assert.equal(receiptCompanyName('  우정  '), '우정운수');
  assert.equal(normalizeReceiptKeyword('가'.repeat(12)), '가'.repeat(12));
});

test('empty, multiline and overlong receipt keywords are rejected', () => {
  for (const input of ['', '   ', '가'.repeat(13), '우\n정', '우\t정', '우\u0000정']) {
    assert.throws(() => normalizeReceiptKeyword(input));
  }
});
