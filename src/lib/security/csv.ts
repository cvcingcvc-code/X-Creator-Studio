/**
 * 安全转义 CSV 单元格：
 * 1. 防御 CSV 公式注入（对以 = + - @ \t \r 开头的内容添加前导单引号）
 * 2. 标准 RFC 4180 引号、逗号与换行转义
 */
export function escapeCsvCell(val: unknown): string {
  let str = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
