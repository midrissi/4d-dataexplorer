export {
  DYNAMIC_ENV_VARS,
  type DynamicEnvVarDef,
  getDynamicEnvVarDescription,
  isDynamicEnvVar,
  listDynamicEnvVarKeys,
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
} from './resolve'
export {
  getActiveEnvMap,
  mergeUnresolved,
  resolveEnvDeep,
  resolveEnvString,
  warnUnresolvedEnvVars,
} from './runtime'
export type {
  Environment,
  EnvironmentsBlock,
  EnvScope,
  EnvVariable,
  EnvVarLookup,
} from './types'
