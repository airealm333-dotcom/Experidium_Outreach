import type { MultiSelectOption } from "@/components/ui/multi-select";

// Apollo's fixed `person_seniorities` enum — do not add arbitrary values here,
// unrecognized codes are silently ignored by Apollo's search API.
export const APOLLO_SENIORITIES: MultiSelectOption[] = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
  { value: "intern", label: "Intern" },
];
