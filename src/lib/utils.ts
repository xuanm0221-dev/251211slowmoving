/**
 * 유틸리티 함수
 */

/**
 * 숫자를 천 단위 콤마 포함 M 단위 문자열로 변환
 * @param value M 단위 숫자
 * @returns 포맷된 문자열 (예: "1,234M")
 */
export function formatAmountM(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "0M";
  }
  return `${value.toLocaleString("ko-KR")}M`;
}

/**
 * 숫자를 천 단위 콤마 포함 원 단위 문자열로 변환
 * @param value 원 단위 숫자
 * @returns 포맷된 문자열 (예: "1,234,567,890")
 */
export function formatAmountWon(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "0";
  }
  return value.toLocaleString("ko-KR");
}

/**
 * 월 문자열을 짧은 형식으로 변환
 * @param month "2024.01" 형식의 문자열
 * @returns "24.01" 형식의 문자열
 */
export function formatMonth(month: string): string {
  const [year, monthNum] = month.split(".");
  return `${year.slice(2)}.${monthNum}`;
}

/**
 * 클래스명 결합 유틸리티
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}







