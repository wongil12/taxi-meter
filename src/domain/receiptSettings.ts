export const DEFAULT_RECEIPT_KEYWORD = '우리';
export const RECEIPT_KEYWORD_LIMIT = 12;

export function normalizeReceiptKeyword(value: string): string {
  const keyword = value.trim();
  if (!keyword || Array.from(keyword).length > RECEIPT_KEYWORD_LIMIT || /[\r\n\t\u0000-\u001f\u007f]/.test(keyword)) {
    throw new Error('이름은 줄바꿈 없이 1~12자로 입력해 주세요.');
  }
  return keyword;
}
export function receiptCompanyName(keyword = DEFAULT_RECEIPT_KEYWORD): string {
  return `${normalizeReceiptKeyword(keyword)}운수`;
}
