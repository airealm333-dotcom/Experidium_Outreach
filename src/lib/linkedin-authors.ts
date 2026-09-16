// LinkedIn contact authors reuse the shared team-member list — see src/lib/team-members.ts.
export {
  TEAM_MEMBERS as LINKEDIN_AUTHORS,
  formatTeamMemberLabel as formatAuthorLabel,
  isTeamMember as isLinkedInAuthor,
  TEAM_MEMBER_COLORS as LINKEDIN_AUTHOR_COLORS,
  teamMemberSelectClass as linkedinAuthorSelectClass,
} from "./team-members";
export type { TeamMember as LinkedInAuthor } from "./team-members";
