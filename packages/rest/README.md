# @4d/rest

A TypeScript client for the 4D REST API with a fluent, type-safe interface.

## Features

- **Fluent API** - Chainable methods for intuitive query building
- **Type Safety** - Full TypeScript support with generics for entity types
- **Testable** - Injectable HTTP client for easy mocking
- **Complete Coverage** - Supports all 4D REST API features

## Installation

```bash
bun add @4d/rest
```

## Quick Start

```typescript
import { RESTClient } from '@4d/rest'

const client = new RESTClient({
  baseUrl: 'http://localhost:8044',
  auth: { username: 'admin', password: 'password' }
})

// Query with fluent API
const employees = await client
  .dataclass('Employee')
  .filter('salary > 50000')
  .orderBy('lastName')
  .select('firstName', 'lastName', 'salary')
  .top(10)
  .fetch()

console.log(employees.__ENTITIES)
```

## Usage

### Type-Safe Entities

Define your entity types for full type safety:

```typescript
import { RESTClient, Entity } from '@4d/rest'

interface Employee extends Entity {
  firstName: string
  lastName: string
  salary: number
  department: string
}

const client = new RESTClient({ baseUrl: 'http://localhost:8044' })

// Typed results
const employees = await client
  .dataclass<Employee>('Employee')
  .filter('department = "Engineering"')
  .fetch()

// employees.__ENTITIES is typed as Employee[]
employees.__ENTITIES.forEach(emp => {
  console.log(`${emp.firstName} ${emp.lastName}: $${emp.salary}`)
})
```

### Query Building

```typescript
const dc = client.dataclass('Employee')

// Filter with parameters
const results = await dc
  .filter('lastName = :1 AND salary > :2')
  .params('Smith', 50000)
  .fetch()

// Order by multiple fields
const sorted = await dc
  .orderBy('department asc, salary desc')
  .fetch()

// Pagination
const page2 = await dc
  .orderBy('lastName')
  .skip(20)
  .top(10)
  .fetch()

// Select specific attributes
const partial = await dc
  .select('firstName', 'lastName', 'email')
  .fetch()

// Expand relations
const withRelations = await dc
  .expand('employer.*')
  .fetch()
```

### CRUD Operations

```typescript
const dc = client.dataclass('Employee')

// Create
const newEmp = await dc.create({
  firstName: 'John',
  lastName: 'Doe',
  salary: 75000
})

// Read
const emp = await dc.get(42)

// Update
const updated = await dc.update(42, {
  salary: 80000,
  __STAMP: emp.__STAMP // Required for optimistic locking
})

// Delete
await dc.delete(42)

// Batch update
await dc.updateMany([
  { __KEY: '1', salary: 80000 },
  { __KEY: '2', salary: 85000 }
])
```

### Entity Operations

```typescript
const entity = client.dataclass('Employee').entity(42)

// Get specific attributes
const partial = await entity.select('firstName', 'lastName')

// Update
await entity.update({ salary: 80000 })

// Delete
await entity.delete()

// Call entity method
const result = await entity.call('calculateBonus', 2024)

// Get related entities
const projects = await entity.getRelatedMany('projects')
```

### Entity Sets

Create cached entity sets for efficient repeated access:

```typescript
// Create entity set
const ref = await client
  .dataclass('Employee')
  .filter('department = "Engineering"')
  .toEntitySet(3600) // 1 hour timeout

console.log(`Entity set ID: ${ref.id}, Count: ${ref.count}`)

// Access entity set
const entitySet = client.dataclass('Employee').entitySet(ref.id)

// Paginate through results
const page1 = await entitySet.fetchPage(0, 20)
const page2 = await entitySet.fetchPage(20, 20)

// Combine entity sets
const combined = await entitySet.and(otherSetId)
const difference = await entitySet.except(otherSetId)

// Release when done (or use client.releaseEntitySet('Employee', entitySetId))
await entitySet.release()
```

### Aggregations

```typescript
const dc = client.dataclass('Employee')

// Single aggregation
const totalSalary = await dc.sum('salary')
const avgSalary = await dc.average('salary')
const maxSalary = await dc.max('salary')
const minSalary = await dc.min('salary')
const count = await dc.count()

// All aggregations at once
const stats = await dc.compute('salary', '$all')
// { salary: { count: 100, sum: 7500000, average: 75000, min: 50000, max: 150000 } }
```

### Class Functions

```typescript
// Dataclass function
const result = await client
  .dataclass('Employee')
  .call('getTopPerformers', 2024, 10)

// Entity function
const bonus = await client
  .dataclass('Employee')
  .entity(42)
  .call('calculateBonus', 2024)
```

### Singletons

```typescript
// Call singleton function
const result = await client
  .singleton('AppConfig')
  .call('getSettings')

// Or via singletons service
const value = await client.singletons.call('AppConfig', 'getValue', 'theme')
```

### Catalog

```typescript
// List all dataclasses
const catalog = await client.catalog.getDataClasses()
console.log(catalog.dataClasses.map(dc => dc.name))

// Get dataclass definition
const empDef = await client.catalog.getDataClass('Employee')
console.log(empDef.attributes)

// Get full catalog (cached)
const full = await client.catalog.getAllCached()
```

### Authentication

```typescript
// Basic auth (set in config)
const client = new RESTClient({
  baseUrl: 'http://localhost:8044',
  auth: { username: 'admin', password: 'password' }
})

// Or login with $catalog/authentify (4D 20 R6+)
await client.login('admin', 'password')

// Check auth status
if (client.isAuthenticated) {
  // ...
}

// Logout
client.logout()
```

### Server Info

```typescript
const info = await client.info.getInfo()
console.log(`Cache: ${info.usedCache}/${info.cacheSize}`)
console.log(`Entity sets: ${info.entitySetCount}`)
console.log(`Sessions: ${info.sessionInfo.length}`)
```

## Testing

The client is designed for easy testing with dependency injection:

```typescript
import { RESTClient, HttpClient } from '@4d/rest'

// Create mock HTTP client
const mockHttp = {
  get: vi.fn().mockResolvedValue({
    __entityModel: 'Employee',
    __COUNT: 1,
    __SENT: 1,
    __FIRST: 0,
    __ENTITIES: [{ __KEY: '1', firstName: 'John' }]
  }),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
} as unknown as HttpClient

// Inject mock
const client = new RESTClient({
  baseUrl: 'http://test',
  httpClient: mockHttp
})

// Test
await client.dataclass('Employee').filter('active = true').fetch()
expect(mockHttp.get).toHaveBeenCalledWith(
  '/Employee',
  expect.objectContaining({ $filter: 'active = true' })
)
```

## Error Handling

```typescript
import {
  RESTClient,
  RESTAPIError,
  AuthenticationError,
  NotFoundError,
  NetworkError
} from '@4d/rest'

try {
  await client.dataclass('Employee').get(999)
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Employee not found')
  } else if (error instanceof AuthenticationError) {
    console.log('Please login')
  } else if (error instanceof RESTAPIError) {
    console.log(`API Error: ${error.message}`)
    console.log(`Error code: ${error.errorCode}`)
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.cause)
  }
}
```

## API Reference

### RESTClient

| Method | Description |
|--------|-------------|
| `dataclass<T>(name)` | Get a DataClassResource for queries and CRUD |
| `singleton(name)` | Get a SingletonResource |
| `releaseEntitySet(dataClass, entitySetId)` | Release an entity set from server cache |
| `login(user, pass)` | Login with credentials |
| `logout()` | Clear authentication |
| `catalog` | CatalogService for introspection |
| `auth` | AuthService for authentication |
| `info` | InfoService for server info |
| `singletons` | SingletonService for singleton calls |

### QueryBuilder

| Method | Description |
|--------|-------------|
| `filter(expr)` | Set filter expression |
| `params(...values)` | Set filter parameter values |
| `orderBy(attr, dir?)` | Set ordering |
| `select(...attrs)` | Select specific attributes |
| `expand(...relations)` | Expand relations |
| `top(n)` / `limit(n)` | Limit results |
| `skip(n)` | Skip results |
| `distinct()` | Return distinct values |
| `fetch()` | Execute and return EntityCollection |
| `fetchOne()` | Execute and return first entity |
| `fetchAll()` | Execute and return entity array |
| `count()` | Return count of matching entities |
| `toEntitySet(timeout?)` | Create cached entity set |
| `delete()` | Delete matching entities |
| `compute(op, attr)` | Compute aggregation |

### DataClassResource

| Method | Description |
|--------|-------------|
| `all()` | Start query for all entities |
| `filter(expr)` | Start query with filter |
| `get(key)` | Get entity by key |
| `getBy(attr, value)` | Get entity by attribute |
| `entity(key)` | Get EntityResource |
| `create(data)` | Create new entity |
| `update(key, data)` | Update entity |
| `delete(key)` | Delete entity |
| `call(fn, ...params)` | Call class function |
| `sum/average/min/max(attr)` | Aggregations |
| `count()` | Count entities |

## License

MIT
