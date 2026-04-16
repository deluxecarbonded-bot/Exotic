import type { User } from "~/types";

const AVATAR_COLORS = [
  "#000000",
  "#1a1a1a",
  "#333333",
  "#4d4d4d",
  "#666666",
  "#808080",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-10 h-10 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-xl",
  xl: "w-24 h-24 text-3xl",
};

export function UserAvatar({
  user,
  name,
  avatarUrl,
  size = "md",
  className = "",
}: {
  user?: User | null;
  name?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const displayName = user?.display_name ?? name ?? "?";
  const url = user?.avatar_url ?? avatarUrl ?? null;

  if (url) {
    return (
      <img
        src={url}
        alt={displayName}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: getAvatarColor(displayName) }}
    >
      {getInitials(displayName)}
    </div>
  );
}

/** Anonymous avatar with "?" */
export function AnonAvatar({
  size = "xs",
  className = "",
}: {
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className="font-bold text-muted-foreground">?</span>
    </div>
  );
}
