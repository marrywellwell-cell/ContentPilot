import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Send } from "lucide-react";

interface StatusBadgeProps {
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
}

const statusConfig = {
  draft: {
    label: "임시저장",
    variant: "secondary" as const,
    icon: Clock,
  },
  scheduled: {
    label: "예약됨",
    variant: "default" as const,
    icon: Clock,
  },
  publishing: {
    label: "발행 중",
    variant: "secondary" as const,
    icon: Send,
  },
  published: {
    label: "발행됨",
    variant: "secondary" as const,
    icon: CheckCircle2,
  },
  failed: {
    label: "실패",
    variant: "destructive" as const,
    icon: AlertCircle,
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
