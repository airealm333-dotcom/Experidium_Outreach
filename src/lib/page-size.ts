export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 10;

export function parsePageSize(raw?: string): PageSizeOption {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? (n as PageSizeOption)
    : DEFAULT_PAGE_SIZE;
}

export function pageSizeQueryValue(pageSize?: number): number | undefined {
  if (pageSize == null || !Number.isFinite(pageSize)) return undefined;
  return pageSize === DEFAULT_PAGE_SIZE ? undefined : Math.floor(pageSize);
}
