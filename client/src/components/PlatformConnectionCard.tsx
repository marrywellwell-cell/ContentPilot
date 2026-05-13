import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface PlatformConnectionCardProps {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function PlatformConnectionCard({
  name,
  icon,
  connected,
  lastSync,
  onConnect,
  onDisconnect,
}: PlatformConnectionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            {icon}
          </div>
          {name}
        </CardTitle>
        {connected ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-chart-5" />
            연결됨
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3 text-muted-foreground" />
            연결 안 됨
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && lastSync && (
          <p className="text-sm text-muted-foreground">
            마지막 동기화: {lastSync}
          </p>
        )}
        <Button
          variant={connected ? "outline" : "default"}
          onClick={connected ? onDisconnect : onConnect}
          className="w-full"
          data-testid={`button-${connected ? 'disconnect' : 'connect'}-${name.toLowerCase()}`}
        >
          {connected ? "연결 해제" : "연결"}
        </Button>
      </CardContent>
    </Card>
  );
}
