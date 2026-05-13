import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
}

export function MetricCard({ title, value, icon: Icon, trend, description }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-semibold mt-2" data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </h3>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 text-chart-5" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={`text-xs font-medium ${trend.isPositive ? 'text-chart-5' : 'text-destructive'}`}>
                  {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </div>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
