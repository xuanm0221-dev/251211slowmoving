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

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="sales-table min-w-max">
        <thead>
          <tr>
            <th className="text-left min-w-[140px] sticky left-0 bg-gray-100 z-20">
              구분
            </th>
            {months.map((month) => (
              <th key={month} className="min-w-[80px]">
                {formatMonth(month)}
              </th>
            ))}
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
                // JSON에 저장된 값은 이미 원 단위
                return (
                  <td
                    key={month}
                    className={cn(
                      row.isHeader && "row-header font-semibold"
                    )}
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
