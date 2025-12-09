import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface ChartDataPoint {
  year: string;
  netWorth: number;
  retirementOwner?: string;
  mortgageFreeAccounts?: string;
}

interface RetirementMilestone {
  year: number;
  owner: string;
  netWorth: number;
}

interface MortgageMilestone {
  year: number;
  accountName: string;
  netWorth: number;
}

export interface NetWorthProjectionChartProps {
  chartData: ChartDataPoint[];
  currentNetWorth: number;
  retirementMilestones?: RetirementMilestone[];
  mortgageMilestones?: MortgageMilestone[];
}

export const NetWorthProjectionChart = ({ chartData, currentNetWorth, retirementMilestones = [], mortgageMilestones = [] }: NetWorthProjectionChartProps) => {
  
  console.log('[NetWorthProjectionChart] Rendering with milestones:', {
    retirementMilestones: retirementMilestones.length,
    mortgageMilestones: mortgageMilestones.length,
    mortgageMilestonesData: mortgageMilestones
  });
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format Y-axis to show in millions
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return formatCurrency(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload as ChartDataPoint;
      const hasRetirement = dataPoint.retirementOwner;
      const hasMortgageFree = dataPoint.mortgageFreeAccounts;
      
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{`Year: ${label}`}</p>
          <p className="text-blue-600">{`Net Worth: ${formatCurrency(payload[0].value)}`}</p>
          {hasRetirement && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="font-semibold text-orange-600 text-sm">{dataPoint.retirementOwner} Retirement</p>
                  <p className="text-xs text-gray-500">Retirement milestone reached</p>
                </div>
              </div>
            </div>
          )}
          {hasMortgageFree && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏠</span>
                <div>
                  <p className="font-semibold text-green-600 text-sm">Mortgage Free!</p>
                  <p className="text-xs text-gray-500">{dataPoint.mortgageFreeAccounts}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Net Worth Projection</h2>
        <p className="text-sm text-gray-600 mt-1">
          Current net worth: {formatCurrency(currentNetWorth)}
        </p>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="year" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={formatYAxis}
              domain={['dataMin - 100000', 'dataMax + 100000']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="netWorth" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={false}
              name="Net Worth"
            />
            {/* Retirement milestone markers */}
            {retirementMilestones.map((milestone) => {
              const yearStr = milestone.year.toString();
              const dataPoint = chartData.find(d => d.year === yearStr);
              if (!dataPoint) return null;
              
              return (
                <ReferenceLine
                  key={`retirement-${milestone.owner}-${milestone.year}`}
                  x={yearStr}
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{
                    value: `🎉 ${milestone.owner}`,
                    position: "top",
                    fill: "#f97316",
                    fontSize: 11,
                    fontWeight: "bold",
                    offset: 5,
                  }}
                />
              );
            })}
            {/* Mortgage-free milestone markers */}
            {mortgageMilestones.map((milestone) => {
              const yearStr = milestone.year.toString();
              const dataPoint = chartData.find(d => d.year === yearStr);
              if (!dataPoint) return null;
              
              return (
                <ReferenceLine
                  key={`mortgage-${milestone.accountName}-${milestone.year}`}
                  x={yearStr}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{
                    value: `🏠 ${milestone.accountName}`,
                    position: "bottom",
                    fill: "#10b981",
                    fontSize: 11,
                    fontWeight: "bold",
                    offset: 5,
                  }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
