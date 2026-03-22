const AVATAR_COLORS = [
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-500 text-white",
  "bg-orange-500 text-white",
  "bg-teal-500 text-white",
  "bg-indigo-500 text-white",
  "bg-lime-600 text-white",
  "bg-fuchsia-500 text-white",
  "bg-blue-500 text-white",
  "bg-pink-500 text-white",
];

// Fixed color overrides by initials
const INITIALS_COLOR_OVERRIDES: Record<string, string> = {
  "MP": "bg-violet-500 text-white",
  "B": "bg-emerald-500 text-white",
  "DP": "bg-blue-500 text-white",
};

/**
 * Returns a color class based on index position.
 */
export function getAvatarColorByIndex(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

/**
 * Returns a consistent color class for a given user, checking initials overrides first.
 */
export function getAvatarColor(userId: string, fullName?: string | null): string {
  if (fullName) {
    const initials = fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    if (INITIALS_COLOR_OVERRIDES[initials]) {
      return INITIALS_COLOR_OVERRIDES[initials];
    }
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getInitials(fullName: string | null, email?: string): string {
  if (fullName) {
    return fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return email?.charAt(0).toUpperCase() || "?";
}
