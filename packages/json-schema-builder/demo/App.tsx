import { useState } from 'react'
import {
  copySchemaPlugin,
  type JSONSchemaRoot,
  SchemaBuilder,
  testSchemaPlugin,
} from '../src/index'

const initialSchema: JSONSchemaRoot = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Display name' },
    count: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
  $defs: {},
}

const plugins = [testSchemaPlugin, copySchemaPlugin]

export default function App() {
  const [schema, setSchema] = useState<JSONSchemaRoot | import('../src/types').JSONSchema>(
    initialSchema
  )

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 text-foreground">
      <header className="shrink-0 border-border/50 border-b bg-card/80 px-6 py-5 shadow-sm backdrop-blur-sm">
        <h1 className="font-semibold text-foreground text-xl tracking-tight">
          JSON Schema Builder
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
          Choose the root type, edit properties, convert blocks to definitions, and use the View
          JSON and Copy schema plugins.
        </p>
      </header>
      <main className="min-h-0 flex-1 p-5">
        <div className="mx-auto max-w-[1600px] rounded-xl border border-border/60 bg-card shadow-sm">
          <SchemaBuilder value={schema} onChange={setSchema} plugins={plugins} />
        </div>
      </main>
    </div>
  )
}
