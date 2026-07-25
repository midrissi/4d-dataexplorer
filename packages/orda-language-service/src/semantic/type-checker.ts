import { getDataClass } from '../schema/catalog-index.ts'
import type {
  AttributeNode,
  ComparatorKind,
  ConditionNode,
  OrderByItemNode,
  QueryNode,
  QueryRootNode,
  ValueNode,
} from '../types/ast.ts'
import type { Diagnostic } from '../types/diagnostics.ts'
import { DiagnosticCode, DiagnosticSeverity } from '../types/diagnostics.ts'
import type { CatalogIndex } from '../types/service.ts'
import { categoriseType, isAttributePlaceholder, resolveAttributeNode } from './type-resolver.ts'

// ---------------------------------------------------------------------------
// Type checker — walks the AST and produces semantic Diagnostics
// ---------------------------------------------------------------------------

export function checkTypes(
  root: QueryRootNode,
  dataclassName: string,
  index: CatalogIndex
): Diagnostic[] {
  const diags: Diagnostic[] = []
  const dc = getDataClass(dataclassName, index)
  if (!dc) {
    diags.push({
      message: `Dataclass '${dataclassName}' not found in catalog`,
      severity: DiagnosticSeverity.Error,
      range: { start: 0, end: 0 },
      code: DiagnosticCode.UnknownDataclass,
    })
    return diags
  }

  if (root.filter) checkNode(root.filter, dataclassName, index, diags)
  if (root.orderBy) {
    for (const item of root.orderBy.items) checkOrderByItem(item, dataclassName, index, diags)
  }

  return diags
}

function checkNode(
  node: QueryNode,
  dataclassName: string,
  index: CatalogIndex,
  diags: Diagnostic[]
): void {
  switch (node.kind) {
    case 'Condition':
      checkCondition(node, dataclassName, index, diags)
      break
    case 'BinaryLogical':
      checkNode(node.left, dataclassName, index, diags)
      checkNode(node.right, dataclassName, index, diags)
      break
    case 'Not':
      checkNode(node.operand, dataclassName, index, diags)
      break
    case 'Group':
      checkNode(node.inner, dataclassName, index, diags)
      break
    case 'Eval':
      // Formula text is opaque — no semantic checks
      break
  }
}

function checkCondition(
  node: ConditionNode,
  dataclassName: string,
  index: CatalogIndex,
  diags: Diagnostic[]
): void {
  if (isAttributePlaceholder(node.left)) return // no schema check for placeholder attrs

  const attrNode = node.left as AttributeNode
  const resolved = resolveAttributeNode(attrNode, dataclassName, index)

  if (!resolved) {
    const path = attrNode.segments.map((s) => s.name).join('.')
    diags.push({
      message: `Unknown attribute path '${path}'`,
      severity: DiagnosticSeverity.Error,
      range: attrNode.range,
      code: DiagnosticCode.UnknownAttribute,
    })
    return
  }

  const { attribute } = resolved
  const attrCat = categoriseType(attribute.type)

  // Relation attributes at leaf position
  if (attribute.kind === 'relatedEntity' || attribute.kind === 'relatedEntities') {
    diags.push({
      message: `Attribute '${attribute.name}' is a relation and cannot be used as a leaf in a condition`,
      severity: DiagnosticSeverity.Warning,
      range: attrNode.range,
      code: DiagnosticCode.RelationTraversalError,
    })
    return
  }

  // % (CONTAINS keyword) only valid on string/object attributes
  if (node.operator === '%' && attrCat !== 'string' && attrCat !== 'object') {
    diags.push({
      message: `Keyword operator '%' (contains) can only be used with string or object attributes, not '${attribute.type}'`,
      severity: DiagnosticSeverity.Error,
      range: node.operatorRange,
      code: DiagnosticCode.PercentOperatorOnNonString,
    })
  }

  // IN operator: right-hand side must be a collection literal or placeholder
  if (node.operator === 'IN') {
    const rhs = node.right
    if (rhs.kind !== 'CollectionLiteral' && rhs.kind !== 'Placeholder') {
      diags.push({
        message: 'The IN operator requires a collection value (e.g., ["a", "b"] or :placeholder)',
        severity: DiagnosticSeverity.Error,
        range: rhs.range,
        code: DiagnosticCode.InValueMustBeCollection,
      })
    }
  }

  // Numeric comparators (<, >, <=, >=) on non-numeric attributes
  const numericOps: ComparatorKind[] = ['<', '>', '<=', '>=']
  if (numericOps.includes(node.operator)) {
    if (attrCat !== 'number' && attrCat !== 'date') {
      diags.push({
        message: `Operator '${node.operator}' is not valid for attribute type '${attribute.type}'`,
        severity: DiagnosticSeverity.Warning,
        range: node.operatorRange,
        code: DiagnosticCode.InvalidOperatorForType,
      })
    }
  }

  // Type mismatch on literal values (skip placeholders)
  checkValueTypeMismatch(node.right, attrCat, node.operatorRange, diags)
}

function checkValueTypeMismatch(
  value: ValueNode,
  attrCat: ReturnType<typeof categoriseType>,
  opRange: { start: number; end: number },
  diags: Diagnostic[]
): void {
  switch (value.kind) {
    case 'NumberLiteral':
      if (attrCat !== 'number' && attrCat !== 'other') {
        diags.push({
          message: `Number value used with '${attrCat}' attribute`,
          severity: DiagnosticSeverity.Warning,
          range: value.range,
          code: DiagnosticCode.TypeMismatch,
        })
      }
      break
    case 'BooleanLiteral':
      if (attrCat !== 'bool' && attrCat !== 'other') {
        diags.push({
          message: `Boolean value used with '${attrCat}' attribute`,
          severity: DiagnosticSeverity.Warning,
          range: value.range,
          code: DiagnosticCode.TypeMismatch,
        })
      }
      break
    case 'DateLiteral':
      if (attrCat !== 'date' && attrCat !== 'other') {
        diags.push({
          message: `Date value used with '${attrCat}' attribute`,
          severity: DiagnosticSeverity.Warning,
          range: value.range,
          code: DiagnosticCode.TypeMismatch,
        })
      }
      break
    default:
      break
  }
  void opRange // opRange kept for future use
}

function checkOrderByItem(
  item: OrderByItemNode,
  dataclassName: string,
  index: CatalogIndex,
  diags: Diagnostic[]
): void {
  if (isAttributePlaceholder(item.attribute)) return

  const attrNode = item.attribute as AttributeNode
  const resolved = resolveAttributeNode(attrNode, dataclassName, index)
  if (!resolved) {
    const path = attrNode.segments.map((s) => s.name).join('.')
    diags.push({
      message: `Unknown attribute '${path}' in ORDER BY`,
      severity: DiagnosticSeverity.Error,
      range: attrNode.range,
      code: DiagnosticCode.UnknownAttribute,
    })
  }
}
