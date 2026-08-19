import { avatarPalette } from "@/lib/format";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

export function Avatar({ handle, size = "md" }: { handle: string; size?: keyof typeof SIZE_CLASSES }) {
  const initials = handle.replace(/^@/, "").slice(0, 2).toUpperCase();

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASSES[size]} ${avatarPalette(handle)}`}
    >
      {initials}
    </span>
  );
}
