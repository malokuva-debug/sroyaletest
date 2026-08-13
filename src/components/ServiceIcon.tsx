import { Brush, Gem, PaintBucket, Flower2, Scissors, Droplets, Sparkles } from "lucide-react";
import type { IconName } from "@/lib/service-meta";

const MAP = {
  brush: Brush,
  gem: Gem,
  paint: PaintBucket,
  flower: Flower2,
  scissors: Scissors,
  droplets: Droplets,
  sparkles: Sparkles,
} as const;

export default function ServiceIcon({
  name,
  className = "w-5 h-5",
}: {
  name: IconName;
  className?: string;
}) {
  const Cmp = MAP[name] ?? Sparkles;
  return <Cmp className={className} />;
}
