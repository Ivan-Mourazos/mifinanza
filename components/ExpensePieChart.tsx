'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/finance'
import { CategoryBreakdownItem } from '@/lib/types'

interface ExpensePieChartProps {
  data: CategoryBreakdownItem[]
  currency?: string
}

export function ExpensePieChart({ data, currency = DEFAULT_CURRENCY }: ExpensePieChartProps) {
  return (
    <div className="h-36 sm:h-40 md:h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => formatCurrency(value, currency)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
