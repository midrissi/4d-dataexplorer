import type { DataClass } from '@4d/rest'

// Extra space reported to ELK so layout keeps nodes apart (avoids overlap of large cards)
export const ELK_NODE_MARGIN = 12

/**
 * Estimate the rendered size of a DataclassNode card from its content.
 * Used both for ELK layout and as `initialWidth`/`initialHeight` hints so
 * `onlyRenderVisibleElements` can cull off-screen nodes before they are measured
 * (keeps initial render / page reload fast on large schemas).
 */
export function estimateCardDimensions(dc: DataClass): { width: number; height: number } {
  const attributes = dc.attributes ?? []
  const storageCount = attributes.filter((a) => a.kind === 'storage').length
  const calculatedCount = attributes.filter(
    (a) => a.kind === 'calculated' || a.kind === 'alias'
  ).length
  const methodCount = dc.methods?.length ?? 0
  const numSections =
    (storageCount > 0 ? 1 : 0) + (calculatedCount > 0 ? 1 : 0) + (methodCount > 0 ? 1 : 0)
  const totalRows = storageCount + calculatedCount + methodCount

  // Match node card: min-w 220, max-w 320; use 320 so large cards don't overlap
  const width = 320
  // Header (52px) + section headers (~28px each) + rows (24px each) + bottom padding (40px)
  const height = 52 + numSections * 28 + totalRows * 24 + 40
  return { width, height }
}
