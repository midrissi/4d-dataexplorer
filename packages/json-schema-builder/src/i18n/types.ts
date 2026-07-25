/**
 * Translation keys for the JSON Schema Builder.
 * All user-facing literals should have an entry here.
 */
export type SchemaBuilderMessages = {
  tabsEditor: string
  tabsDefinitions: string
  /** Notice explaining which JSON Schema draft(s) are supported (e.g. draft-07, 2020-12). */
  jsonSchemaDraftNotice: string
  /** Label for the "include $schema in output" option. */
  includeSchemaAttrLabel: string
  typePlaceholder: string
  typeString: string
  typeNumber: string
  typeInteger: string
  typeBoolean: string
  typeNull: string
  typeObject: string
  typeArray: string
  typeOneOf: string
  typeAnyOf: string
  typeAllOf: string
  typeRef: string
  common: string
  commonTitle: string
  commonDescription: string
  commonDefaultJson: string
  commonExamplesJson: string
  commonReadOnly: string
  commonWriteOnly: string
  commonDeprecated: string
  commonResetValue: string
  commonClickToReset: string
  commonHasValueClickToReset: string
  placeholderDash: string
  placeholderPropertyName: string
  placeholderRegexPattern: string
  placeholderIfPresentProperty: string
  placeholderRequiredWhenPresent: string
  placeholderValue: string
  placeholderFormatExample: string
  placeholderChooseDefinition: string
  defsTitle: string
  defsAddDefinition: string
  defsClose: string
  defsRenameDefinition: string
  defsRemoveDefinition: string
  defsNoDefinitionsYet: string
  defsDefinitionIds: string
  defsSchemaFor: string
  propsProperties: string
  propsAddProperty: string
  propsRemoveProperty: string
  propsRequired: string
  propsExpandAll: string
  propsCollapseAll: string
  propsExpandAllTooltip: string
  propsCollapseAllTooltip: string
  propsExpandDetails: string
  propsCollapseDetails: string
  propsAdditionalProperties: string
  propsMinProperties: string
  propsMaxProperties: string
  propsUnevaluatedProperties: string
  propsPatternProperties: string
  propsDependentRequired: string
  propsDependentSchemas: string
  emptyNoDependentRequired: string
  emptyNoDependentSchemas: string
  emptyNoPatternProperties: string
  propsNotAllowed: string
  propsAny: string
  propsSchema: string
  arrayItems: string
  arrayAdditionalItems: string
  arrayUnevaluatedItems: string
  arrayPrefixItems: string
  arrayMinItems: string
  arrayMaxItems: string
  arrayMinContains: string
  arrayMaxContains: string
  arrayUniqueItems: string
  arrayAddItem: string
  arrayRemoveItem: string
  arrayItemN: string
  arraySingleSchema: string
  arrayTuple: string
  arrayAddEnumValue: string
  arrayContains: string
  arrayClear: string
  arraySetSchema: string
  arrayAdd: string
  arrayNoPrefixItems: string
  arrayPrefixN: string
  primitiveMinLength: string
  primitiveMaxLength: string
  primitiveFormat: string
  primitivePattern: string
  primitiveEnum: string
  primitiveMinimum: string
  primitiveMaximum: string
  primitiveMultipleOf: string
  primitiveNoOptionsFor: string
  refEditDefinitions: string
  convertToDefinition: string
  sortableDragToReorder: string
  remove: string
  removeBranch: string
  removeEnumValue: string
  labelType: string
  compositeAddBranch: string
  compositeBranchN: string
  pluginViewJson: string
  pluginTestSchema: string
  pluginCopySchema: string
  pluginCopyExample: string
  pluginCopied: string
  editorFormatDocument: string
  editorCopyCode: string
  editorCopied: string
  editorUndo: string
  editorRedo: string
  editorZoomIn: string
  editorZoomOut: string
  editorResetZoom: string
  editorEnableWordWrap: string
  editorDisableWordWrap: string
  editorShowMinimap: string
  editorHideMinimap: string
  editorMoveToolbarToTop: string
  editorMoveToolbarToBottom: string
}

export type SchemaBuilderLang = 'en' | 'fr' | 'es'

/** Optional overrides on top of a base locale. All keys optional; fallback to base locale. */
export type SchemaBuilderOverrides = { base?: SchemaBuilderLang } & Partial<SchemaBuilderMessages>

/** Language: either a locale code or an object with optional base + partial overrides. */
export type SchemaBuilderLangOrOverrides = SchemaBuilderLang | SchemaBuilderOverrides
