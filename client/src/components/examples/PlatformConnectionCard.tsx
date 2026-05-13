import { PlatformConnectionCard } from "../PlatformConnectionCard";
import { Instagram, Chrome } from "lucide-react";
import { SiNaver } from "react-icons/si";

export default function PlatformConnectionCardExample() {
  return (
    <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
      <PlatformConnectionCard
        name="Instagram"
        icon={<Instagram className="h-5 w-5" />}
        connected={true}
        lastSync="2 hours ago"
        onConnect={() => console.log("Connect Instagram")}
        onDisconnect={() => console.log("Disconnect Instagram")}
      />
      <PlatformConnectionCard
        name="Naver Blog"
        icon={<SiNaver className="h-5 w-5" />}
        connected={false}
        onConnect={() => console.log("Connect Naver")}
        onDisconnect={() => console.log("Disconnect Naver")}
      />
      <PlatformConnectionCard
        name="WordPress"
        icon={<Chrome className="h-5 w-5" />}
        connected={true}
        lastSync="1 day ago"
        onConnect={() => console.log("Connect WordPress")}
        onDisconnect={() => console.log("Disconnect WordPress")}
      />
    </div>
  );
}
