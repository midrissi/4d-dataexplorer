# REST Server

A mock 4D REST API server built with Bun and Elysia for testing and development of the Data Explorer application.

## Features

- Simulates 4D REST API endpoints
- Serves static files from `apps/dataexplorer/DataBrowser` at `/dataexplorer/`
- In-memory data store with sample data
- Supports all endpoints used by dataexplorer:
  - `GET /rest/$catalog` - List dataclasses
  - `GET /rest/$catalog/$all` - Full catalog with attributes
  - `GET /rest/:dataclassName` - Query entities with filters, pagination, sorting
  - `GET /rest/:dataclassName(:key)` - Get single entity
  - `POST /rest/:dataclassName` - Create entities
  - `POST /rest/:dataclassName` with `$method=update` - Update entities
  - `POST /rest/:dataclassName(:key)` with `$method=delete` - Delete entities
  - `POST /api/login` - Login endpoint

## Usage

Start the server:

```bash
bun run dev
```

Or:

```bash
bun run start
```

The server will start on `http://localhost:7080` by default. You can change the port using the `PORT` environment variable:

```bash
PORT=8080 bun run dev
```

### Serving the Data Explorer App

The server automatically serves the built Data Explorer app from `apps/dataexplorer/DataBrowser` at the `/dataexplorer/` path. Make sure to build the app first:

```bash
# Build the dataexplorer app
bun --filter @4d/dataexplorer build

# Start the rest-server
cd packages/rest-server
bun run dev
```

Then access the app at `http://localhost:7080/dataexplorer/`

## Sample Data

The server comes pre-loaded with sample dataclasses:
- **Users** - User entities with ID, firstName, lastName, email, age, createdAt
- **Products** - Product entities with ID, name, price, description, stock
- **Orders** - Order entities with ID, orderNumber, userId, total, status, createdAt

## API Endpoints

### Catalog

- `GET /rest/$catalog` - Get list of dataclasses
- `GET /rest/$catalog/$all` - Get full catalog with attributes
- `GET /rest/$catalog/:name` - Get specific dataclass definition

### Entities

- `GET /rest/:dataclassName` - Query entities
  - Query parameters:
    - `$top` - Limit number of results
    - `$skip` - Skip number of results (pagination)
    - `$filter` - Filter expression (simple string matching)
    - `$orderby` - Sort by attribute (e.g., "name asc" or "price desc")
    - `$attributes` - Comma-separated list of attributes to return
    - `$count` - Return count only (set to "true")

- `GET /rest/:dataclassName(:key)` - Get single entity by key

- `POST /rest/:dataclassName` - Create entity(ies)
  - Body: Single entity object or array of entities

- `POST /rest/:dataclassName?$method=update` - Update entity(ies)
  - Body: Entity object with `__KEY` or array of entities

- `POST /rest/:dataclassName(:key)?$method=delete` - Delete entity

### Authentication

- `POST /api/login` - Login endpoint
  - Content-Type: `multipart/form-data`
  - Form field: `accessKey`
  - Valid access key: `123`

## Example Requests

### Get catalog
```bash
curl http://localhost:7080/rest/\$catalog
```

### Get entities with pagination
```bash
curl "http://localhost:7080/rest/Users?\$top=10&\$skip=0"
```

### Get entity count
```bash
curl "http://localhost:7080/rest/Users?\$count=true"
```

### Create entity
```bash
curl -X POST http://localhost:7080/rest/Users \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Alice", "lastName": "Wonder", "email": "alice@example.com", "age": 28}'
```

### Update entity
```bash
curl -X POST "http://localhost:7080/rest/Users?\$method=update" \
  -H "Content-Type: application/json" \
  -d '{"__KEY": "1", "firstName": "John Updated", "age": 31}'
```

### Login
```bash
curl -X POST http://localhost:7080/api/login \
  -F "accessKey=123"
```

## Development

The server uses an in-memory store, so data is reset on each restart. To persist data, you would need to implement a database adapter.

## Integration with Data Explorer

To use this server with the dataexplorer app, set the `BACKEND_URL` environment variable:

```bash
BACKEND_URL=http://localhost:7080 bun --filter @4d/dataexplorer dev
```

Or update the vite config to point to this server.
