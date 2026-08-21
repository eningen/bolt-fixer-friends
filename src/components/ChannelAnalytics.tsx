import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  subscribers: { created_at: string }[];
  totalViews: number;
  videoCount: number;
};

const DAYS = 30;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ChannelAnalytics({ subscribers, totalViews, videoCount }: Props) {
  const { series, last7 } = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const row of subscribers) {
      const key = row.created_at.slice(0, 10);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS - 1));
    const startKey = dayKey(start);

    // 期間開始前の累積
    let cumulative = 0;
    for (const row of subscribers) {
      if (row.created_at.slice(0, 10) < startKey) cumulative += 1;
    }

    const points: { date: string; label: string; total: number; gained: number }[] = [];
    for (let i = 0; i < DAYS; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      const gained = perDay.get(key) ?? 0;
      cumulative += gained;
      points.push({
        date: key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        total: cumulative,
        gained,
      });
    }

    const gained7 = points.slice(-7).reduce((sum, p) => sum + p.gained, 0);
    return { series: points, last7: gained7 };
  }, [subscribers]);

  const totalSubscribers = subscribers.length;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-bold">チャンネル分析</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">登録者数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold">{totalSubscribers.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              過去7日間の増加
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-primary">
              {last7 > 0 ? `+${last7.toLocaleString()}` : last7.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">総再生回数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold">{totalViews.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">{videoCount} 本の動画</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            登録者数の推移（過去30日）
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64 pl-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="subsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval={Math.ceil(DAYS / 6)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item) =>
                  [`${value} 人（+${item?.payload?.gained ?? 0}）`, "登録者数"] as [string, string]
                }
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#subsFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}
