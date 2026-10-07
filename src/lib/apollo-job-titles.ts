import type { MultiSelectOption } from "@/components/ui/multi-select";

/**
 * Curated Apollo person_titles for campaign people search.
 * Values are sent as-is to Apollo — keep them human-readable title strings.
 */
const TITLE_LABELS = [
  // Primary buyer titles (Apollo ICP)
  "VP Supply Chain",
  "Director of Supply Chain",
  "VP of Operations",
  "Director of Operations",
  "Head of Supply Chain",
  "Supply Chain Director",
  "Chief Operating Officer",
  "COO",
  // Secondary / champion titles
  "Head of Procurement",
  "Procurement Manager",
  "Director of Procurement",
  "VP Procurement",
  "Inventory Manager",
  "Demand Planning Manager",
  "Logistics Manager",
  "IT Director",
  "CTO",
  // Common related titles
  "VP Sales",
  "Head of Sales",
  "Director of Sales",
  "VP of Sales",
  "Chief Supply Chain Officer",
  "Head of Operations",
  "Operations Manager",
  "Supply Chain Manager",
  "Procurement Director",
  "VP Logistics",
  "Director of Logistics",
  "Head of Logistics",
  "VP Planning",
  "Director of Planning",
  "Materials Manager",
  "Sourcing Manager",
  "Director of Sourcing",
  "VP Sourcing",
] as const;

export const APOLLO_JOB_TITLES: MultiSelectOption[] = TITLE_LABELS.map((title) => ({
  value: title,
  label: title,
}));
