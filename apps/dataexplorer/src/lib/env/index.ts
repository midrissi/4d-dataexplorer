export {
  DYNAMIC_ENV_VARS,
  type DynamicEnvVarDef,
  type DynamicGenerateOptions,
  getDynamicEnvVarDescription,
  getEnvFaker,
  invokeFakerPath,
  isDynamicEnvVar,
  isFakerPathKey,
  listAllDynamicEnvVarDefs,
  listDynamicEnvVarKeys,
  listFakerModuleMethods,
  listFakerModules,
  listHelperTemplateKeys,
  resolveDynamicEnvVar,
} from './dynamic'
export {
  type ActiveEnvLayers,
  effectiveEnvValue,
  findEnvironmentById,
  findEnvironmentByName,
  lookupEnvVariable,
  mergeActiveEnvMap,
  type ScopeLabels,
  variablesToMap,
} from './merge-active'
export {
  applyEnvTemplateDecorations,
  registerEnvTemplateCompletionProvider,
} from './monaco-env-templates'
export {
  cloneEnvironment,
  createEmptyEnvironment,
  createEmptyVariable,
  createEnvironmentId,
  ENVIRONMENT_COLORS,
  type EnvironmentsExport,
  ensureEnvironmentColors,
  nextEnvironmentColor,
  nextNewEnvironmentName,
  normalizeEnvironmentsBlock,
  parseEnvironmentsImport,
  resetVariablesToInitial,
} from './normalize'
export type { EnvTemplateSegment } from './resolve'
export {
  collectEnvTemplateKeys,
  collectUnresolved,
  ENV_TEMPLATE_RE,
  parseEnvTemplateSegments,
  resolveEnvTemplates,
  resolveEnvTemplatesDeep,
  resolveEnvTemplatesDeepWithThis,
} from './resolve'
export {
  getActiveEnvMap,
  mergeUnresolved,
  resolveEnvDeep,
  resolveEnvString,
  warnUnresolvedEnvVars,
} from './runtime'
export {
  buildFieldTemplateSuggestions,
  type FieldTemplateHint,
  mergeFieldTemplateSuggestions,
  normalizeFieldKey,
  proposeFieldTemplateKeys,
  tokenizeFieldName,
  withFieldTemplateSuggestions,
} from './suggest-field-templates'
export {
  HELPER_FILTER_NAMES,
  HELPER_TEMPLATE_DEFS,
  type HelperTemplateDef,
  type HelperTemplateResult,
  isHelperTemplateKey,
  isStructuredHelperKey,
  resolveHelperArgValue,
  resolveHelperTemplate,
} from './template-helpers'
export {
  type EnvTemplateThis,
  isThisTemplateKey,
  listThisSuggestionKeys,
  type ResolveEnvOptions,
  resolveThisPath,
  stringifyThisValue,
} from './this-context'
export {
  buildEntityThis,
  buildHttpThis,
  buildMethodThis,
  buildQueryThis,
} from './this-context-builders'
export type {
  Environment,
  EnvironmentsBlock,
  EnvScope,
  EnvVariable,
  EnvVarLookup,
} from './types'
