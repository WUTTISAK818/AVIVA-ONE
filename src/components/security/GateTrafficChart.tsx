"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Row {
  hour: string;
  entry: number;
  exit: number;
}

export default function GateTrafficChart({ data }: { data: Row[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--color-aviva-secondary)" }} interval={1} />
          <YAxis tick={{ fontSize: 10, fill: "var(--color-aviva-secondary)" }} />
          <Tooltip contentStyle={{
            background: "var(--color-aviva-card)",
            border: "1px solid var(--color-aviva-gold)",
            borderRadius: "8px",
            fontSize: 12,
          }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="entry" name="ขาเข้า" fill="var(--color-aviva-gold)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="exit" name="ขาออก" fill="var(--color-aviva-gold-soft)" opacity={0.7} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
