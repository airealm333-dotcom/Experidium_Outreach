export const LINKEDIN_AUTHORS = ["adithyan", "adarsh", "vishnu"] as const;

export type LinkedInAuthor = (typeof LINKEDIN_AUTHORS)[number];

export function formatAuthorLabel(author: string): string {
  return author.charAt(0).toUpperCase() + author.slice(1);
}

export function isLinkedInAuthor(value: string): value is LinkedInAuthor {
  return (LINKEDIN_AUTHORS as readonly string[]).includes(value);
}

export const LINKEDIN_AUTHOR_COLORS: Record<LinkedInAuthor, string> = {
  adithyan:
    "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
  adarsh:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
  vishnu:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
};

export function linkedinAuthorSelectClass(author: string): string {
  if (isLinkedInAuthor(author)) {
    return LINKEDIN_AUTHOR_COLORS[author];
  }
  return "border-input bg-background text-foreground";
}
