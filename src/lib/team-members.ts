export const TEAM_MEMBERS = ["adithyan", "adarsh", "vishnu"] as const;

export type TeamMember = (typeof TEAM_MEMBERS)[number];

export function formatTeamMemberLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function isTeamMember(value: string): value is TeamMember {
  return (TEAM_MEMBERS as readonly string[]).includes(value);
}

export const TEAM_MEMBER_COLORS: Record<TeamMember, string> = {
  adithyan:
    "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
  adarsh:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
  vishnu:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
};

export function teamMemberSelectClass(name: string): string {
  if (isTeamMember(name)) {
    return TEAM_MEMBER_COLORS[name];
  }
  return "border-input bg-background text-foreground";
}
