import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import type { TopicWeightageItem } from '../types';

interface TopicWeightageViewProps {
  topicWeightage: TopicWeightageItem[];
  onInspectTopic: (topic: string) => void;
}

const CHART_COLORS = [
  '#1D4ED8', // Academic Cobalt
  '#0F766E', // Deep Teal
  '#B45309', // Warm Ochre
  '#4338CA', // Indigo
  '#0369A1', // Cerulean
  '#475569', // Slate
  '#9333EA', // Violet
  '#BE123C', // Crimson
];

interface TooltipPayloadItem {
  payload: TopicWeightageItem;
}

function CustomChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm text-xs">
      <p className="font-semibold text-slate-900">{item.topic}</p>
      <div className="mt-1.5 space-y-0.5 text-slate-600 font-mono tabular-nums">
        <p>Share: {item.percentage}%</p>
        <p>Questions: {item.questionCount}</p>
        <p>Est. Marks: {item.totalMarks}</p>
        <p>High Priority: {item.highPriorityCount}</p>
      </div>
    </div>
  );
}

export function TopicWeightageView({
  topicWeightage,
  onInspectTopic,
}: TopicWeightageViewProps) {
  const [chartMode, setChartMode] = useState<'bar' | 'pie'>('bar');

  if (topicWeightage.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <p className="text-base font-semibold text-slate-900">No topic weightage data available</p>
        <p className="mt-1 text-sm text-slate-500">
          Upload question papers to see the chapter-wise mark distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left/Primary Chart Surface */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Topic-Wise Weightage</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Share of total questions across {topicWeightage.length} syllabus units
            </p>
          </div>

          {/* Interactive Bar / Pie Toggle */}
          <div
            role="group"
            aria-label="Chart visualization type"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                chartMode === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bar Chart
            </button>
            <button
              type="button"
              onClick={() => setChartMode('pie')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                chartMode === 'pie'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pie Chart
            </button>
          </div>
        </div>

        <div className="mt-6 h-[360px] w-full">
          {chartMode === 'bar' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topicWeightage}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 'dataMax + 5']}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="topic"
                  width={150}
                  tick={{ fill: '#0F172A', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: string) =>
                    val.length > 22 ? `${val.slice(0, 21)}…` : val
                  }
                />
                <Tooltip content={<CustomChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={24}>
                  {topicWeightage.map((entry, idx) => (
                    <Cell
                      key={entry.topic}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      className="cursor-pointer"
                      onClick={() => onInspectTopic(entry.topic)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topicWeightage}
                      dataKey="percentage"
                      nameKey="topic"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      onClick={(_data, index) => {
                        const clicked = topicWeightage[index];
                        if (clicked) onInspectTopic(clicked.topic);
                      }}
                    >
                      {topicWeightage.map((entry, idx) => (
                        <Cell
                          key={entry.topic}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          className="cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Clean Legend */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-700">
                {topicWeightage.map((item, idx) => (
                  <button
                    key={item.topic}
                    type="button"
                    onClick={() => onInspectTopic(item.topic)}
                    className="inline-flex items-center gap-1.5 hover:text-blue-700 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[150px]">{item.topic}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {item.percentage}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right High-Density Data Table */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Chapter Breakdown</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Select any topic to filter the Important Questions list
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 pl-5 pr-3">Topic</th>
                <th className="py-2.5 px-3 text-right">Share</th>
                <th className="py-2.5 px-3 text-right">Qs</th>
                <th className="py-2.5 pl-3 pr-5 text-right">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {topicWeightage.map((item, idx) => (
                <tr
                  key={item.topic}
                  onClick={() => onInspectTopic(item.topic)}
                  className="group cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 pl-5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
                        {item.topic}
                      </span>
                      <ArrowUpRight
                        className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors"
                        aria-hidden="true"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 font-medium">
                    {item.percentage}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {item.questionCount}
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right font-mono tabular-nums text-slate-600">
                    {item.totalMarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
