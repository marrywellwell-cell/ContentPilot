import { MetricCard } from "../MetricCard";
import { FileText, Calendar, TrendingUp, Eye } from "lucide-react";

export default function MetricCardExample() {
  return (
    <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Content"
        value="124"
        icon={FileText}
        trend={{ value: 12, isPositive: true }}
        description="vs last month"
      />
      <MetricCard
        title="Scheduled"
        value="18"
        icon={Calendar}
        trend={{ value: 8, isPositive: true }}
        description="this week"
      />
      <MetricCard
        title="Engagement Rate"
        value="4.8%"
        icon={TrendingUp}
        trend={{ value: 15, isPositive: true }}
        description="vs last week"
      />
      <MetricCard
        title="Total Views"
        value="45.2K"
        icon={Eye}
        trend={{ value: 3, isPositive: false }}
        description="vs last month"
      />
    </div>
  );
}
