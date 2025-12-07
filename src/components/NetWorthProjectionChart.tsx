import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import type { ProjectionResult, ProjectionScenario } from '../types/models';

interface Milestone {
  year: number;
  netWorth: number;
  type: 'debt_free' | 'retirement' | 'net_worth_threshold' | 'peak';
  label: string;
  targetSection: string;
  description?: string;
}

interface NetWorthProjectionChartProps {
  result: ProjectionResult;
  scenario?: ProjectionScenario;
  onMilestoneClick?: (sectionId: string) => void;
}

export const NetWorthProjectionChart = ({ result, scenario, onMilestoneClick }: NetWorthProjectionChartProps) => {
  console.log('[NetWorthProjectionChart] Rendering chart with milestones');
  
  // Prepare data for chart - use yearly data for cleaner visualization
  const chartData = result.yearlyData.map(year => ({
    year: year.year.toString(),
    netWorth: Math.round(year.endingNetWorth),
    assets: result.monthlyData
      .filter(m => m.year === year.year)
      .reduce((sum, m) => sum + m.totalAssets, 0) / 12, // Average assets for the year
    liabilities: result.monthlyData
      .filter(m => m.year === year.year)
      .reduce((sum, m) => sum + m.totalLiabilities, 0) / 12, // Average liabilities for the year
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Detect milestones
  const detectMilestones = (): Milestone[] => {
    const milestones: Milestone[] = [];
    
    // 1. Debt-free date
    if (result.summary.debtFreeDate) {
      const debtFreeDate = new Date(result.summary.debtFreeDate);
      const debtFreeYear = debtFreeDate.getFullYear();
      const yearData = result.yearlyData.find(y => y.year === debtFreeYear);
      if (yearData) {
        milestones.push({
          year: debtFreeYear,
          netWorth: yearData.endingNetWorth,
          type: 'debt_free',
          label: 'Debt Free',
          targetSection: 'retirement-planning',
          description: 'All debts paid off',
        });
      }
    }

    // 2. Retirement age
    if (scenario) {
      const targetRetirementAge = scenario.assumptions.retirement?.targetRetirementAge || scenario.assumptions.targetRetirementAge;
      if (targetRetirementAge) {
        const startDate = new Date(scenario.config.startDate);
        const startYear = startDate.getFullYear();
        const startAge = startDate.getFullYear() - 1970; // Approximate, could be improved
        const retirementYear = startYear + (targetRetirementAge - startAge);
        const yearData = result.yearlyData.find(y => y.year === retirementYear);
        if (yearData) {
          milestones.push({
            year: retirementYear,
            netWorth: yearData.endingNetWorth,
            type: 'retirement',
            label: 'Retirement',
            targetSection: 'retirement-planning',
            description: `Target retirement age: ${targetRetirementAge}`,
          });
        }
      }
    }

    // 3. Peak net worth
    if (result.summary.peakNetWorthYear) {
      const yearData = result.yearlyData.find(y => y.year === result.summary.peakNetWorthYear);
      if (yearData) {
        milestones.push({
          year: result.summary.peakNetWorthYear,
          netWorth: yearData.endingNetWorth,
          type: 'peak',
          label: 'Peak Net Worth',
          targetSection: 'investments',
          description: `Peak value: ${formatCurrency(result.summary.peakNetWorth)}`,
        });
      }
    }

    // 4. Net worth thresholds ($250k, $500k, $1M, $2M, $5M)
    const thresholds = [250000, 500000, 1000000, 2000000, 5000000];
    const maxNetWorth = Math.max(...result.yearlyData.map(y => y.endingNetWorth));
    
    thresholds.forEach(threshold => {
      if (threshold <= maxNetWorth) {
        // Find first year where net worth crosses threshold
        for (const yearData of result.yearlyData) {
          if (yearData.endingNetWorth >= threshold) {
            // Check if we already have a milestone for this year
            if (!milestones.some(m => m.year === yearData.year && m.type === 'net_worth_threshold')) {
              milestones.push({
                year: yearData.year,
                netWorth: yearData.endingNetWorth,
                type: 'net_worth_threshold',
                label: formatCurrency(threshold),
                targetSection: 'investments',
                description: `Reached ${formatCurrency(threshold)}`,
              });
            }
            break;
          }
        }
      }
    });

    return milestones.sort((a, b) => a.year - b.year);
  };

  const milestones = detectMilestones();
  console.log('[NetWorthProjectionChart] Detected milestones:', milestones);

  const handleMilestoneClick = (milestone: Milestone) => {
    console.log('[NetWorthProjectionChart] Milestone clicked:', milestone);
    if (onMilestoneClick) {
      onMilestoneClick(milestone.targetSection);
    }
  };

  // Get color for milestone type
  const getMilestoneColor = (type: Milestone['type']): string => {
    switch (type) {
      case 'debt_free':
        return '#10b981'; // emerald
      case 'retirement':
        return '#f59e0b'; // amber
      case 'net_worth_threshold':
        return '#8b5cf6'; // violet
      case 'peak':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="year" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => {
              const millions = value / 1000000;
              return `$${millions.toFixed(millions >= 1 ? 1 : 2)}M`;
            }}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="#3b82f6"
            strokeWidth={3}
            name="Net Worth"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          {/* Milestone markers */}
          {milestones.map((milestone, index) => {
            const color = getMilestoneColor(milestone.type);
            return (
              <ReferenceLine
                key={`milestone-${milestone.year}-${index}`}
                x={milestone.year.toString()}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="5 5"
                label={
                  <Label
                    value={milestone.label}
                    position="top"
                    fill={color}
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: onMilestoneClick ? 'pointer' : 'default',
                    }}
                    onClick={() => handleMilestoneClick(milestone)}
                  />
                }
              />
            );
          })}
          {/* Milestone data points */}
          {milestones.map((milestone, index) => {
            const color = getMilestoneColor(milestone.type);
            const dataPoint = chartData.find(d => d.year === milestone.year.toString());
            if (dataPoint) {
              return (
                <ReferenceLine
                  key={`milestone-point-${milestone.year}-${index}`}
                  y={milestone.netWorth}
                  stroke={color}
                  strokeWidth={0}
                  label={
                    <Label
                      value="●"
                      position="insideTopRight"
                      fill={color}
                      style={{
                        fontSize: '16px',
                        cursor: onMilestoneClick ? 'pointer' : 'default',
                      }}
                      onClick={() => handleMilestoneClick(milestone)}
                    />
                  }
                />
              );
            }
            return null;
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};



