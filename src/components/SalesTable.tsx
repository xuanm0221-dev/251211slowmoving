"use client";

import { SalesItemTabData, SalesMonthData, SALES_TABLE_ROWS } from "@/types/sales";
import { formatAmountWon, formatMonth, cn } from "@/lib/utils";

interface SalesTableProps {
  data: SalesItemTabData;
  months: string[];
}

export default function SalesTable({ data, months }: SalesTableProps) {
  const getCellValue = (month: string, dataKey: string): number => {
    const monthData: SalesMonthData | undefined = data[month];
    if (!monthData) return 0;

    if (dataKey === "전체") {
      return monthData.전체_core + monthData.전체_outlet;
    }
    if (dataKey === "FRS") {
      return monthData.FRS_core + monthData.FRS_outlet;
    }
    if (dataKey === "OR") {
      return monthData.OR_core + monthData.OR_outlet;
    }

    return monthData[dataKey as keyof SalesMonthData] ?? 0;
  };

  const isForecastMonth = (month: string): boolean => {
    return data[month]?.isForecast === true;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="sales-table min-w-max">
        <thead>
          <tr>
            <th className="text-left min-w-[140px] sticky left-0 bg-gray-100 z-20">
              구분
            </th>
            {months.map((month) => {
              const isForecast = isForecastMonth(month);
              return (
                <th
                  key={month}
                  className={cn(
                    "min-w-[80px]",
                    isForecast && "bg-blue-50"
                  )}
                  title={isForecast ? "예상 판매매출" : ""}
                >
                  <div className="flex items-center justify-center gap-1">
                    {formatMonth(month)}
                    {isForecast && (
                      <span className="text-xs text-blue-600" title="예상치">
                        F
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {SALES_TABLE_ROWS.map((row, idx) => (
            <tr key={idx}>
              <td
                className={cn(
                  "text-left sticky left-0 bg-white z-10",
                  row.isHeader && "row-header font-semibold text-gray-800",
                  row.indent && "row-indent"
                )}
              >
                {row.label}
              </td>
              {months.map((month) => {
                const value = getCellValue(month, row.dataKey);
                const isForecast = isForecastMonth(month);
                // JSON에 저장된 값은 이미 원 단위
                return (
                  <td
                    key={month}
                    className={cn(
                      row.isHeader && "row-header font-semibold",
                      isForecast && "text-gray-500 italic bg-blue-50/30"
                    )}
                    title={isForecast ? "예상 판매매출" : ""}
                  >
                    {formatAmountWon(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
