import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 };
const GRID = "var(--border)";

export function TinyArea({ data, dataKey = "value" }: { data: any[]; dataKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="ta" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke="var(--foreground)" strokeWidth={1.5} fill="url(#ta)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueArea({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} {...AXIS} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
        <Area type="monotone" dataKey="secondary" stroke="var(--muted-foreground)" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="value" stroke="var(--foreground)" strokeWidth={2} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, xKey = "channel", yKey = "revenue" }: { data: any[]; xKey?: string; yKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} {...AXIS} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey={yKey} fill="var(--foreground)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineDual({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} {...AXIS} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" name="Actual"   dataKey="value"     stroke="var(--foreground)" strokeWidth={2} dot={false} />
        <Line type="monotone" name="Forecast" dataKey="secondary" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["var(--foreground)", "oklch(0.45 0 0)", "oklch(0.6 0 0)", "oklch(0.75 0 0)", "oklch(0.85 0 0)"];

export function Donut({ data, dataKey = "value", nameKey = "label" }: { data: any[]; dataKey?: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={60} outerRadius={95} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StackedRevenue({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} {...AXIS} />
        <YAxis tickLine={false} axisLine={false} {...AXIS} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--foreground)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="expense" name="Expense" fill="oklch(0.78 0 0)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Heatmap({ rows = 7, cols = 24 }: { rows?: number; cols?: number }) {
  const cells = Array.from({ length: rows * cols }).map((_, i) => {
    const v = (Math.sin(i * 0.7) + 1) / 2;
    return v;
  });
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {cells.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-[3px]"
          style={{ background: `oklch(${0.98 - v * 0.7} 0 0)` }}
          title={`${Math.round(v * 100)}`}
        />
      ))}
    </div>
  );
}
