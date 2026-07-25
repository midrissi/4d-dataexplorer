import type { CatalogAllResponse } from '@4d/rest'

/**
 * Minimal test catalog matching the rest-server sample data (Users/Products/Orders),
 * extended with a relation (Orders → Users via userId) for traversal testing.
 */
export const testCatalog: CatalogAllResponse = {
  dataClasses: [
    {
      name: 'Users',
      collectionName: 'Users',
      dataURI: '/rest/Users',
      attributes: [
        {
          name: 'ID',
          kind: 'storage',
          type: 'long',
          indexed: true,
          unique: true,
          identifying: true,
        },
        { name: 'firstName', kind: 'storage', type: 'string', indexed: true },
        { name: 'lastName', kind: 'storage', type: 'string', indexed: true },
        { name: 'email', kind: 'storage', type: 'string', indexed: true, unique: true },
        { name: 'age', kind: 'storage', type: 'long' },
        { name: 'createdAt', kind: 'storage', type: 'date' },
        { name: 'active', kind: 'storage', type: 'bool' },
        { name: 'orders', kind: 'relatedEntities', type: 'OrdersSelection', inverseName: 'user' },
      ],
      key: [{ name: 'ID' }],
    },
    {
      name: 'Products',
      collectionName: 'Products',
      dataURI: '/rest/Products',
      attributes: [
        {
          name: 'ID',
          kind: 'storage',
          type: 'long',
          indexed: true,
          unique: true,
          identifying: true,
        },
        { name: 'name', kind: 'storage', type: 'string', indexed: true },
        { name: 'price', kind: 'storage', type: 'number' },
        { name: 'description', kind: 'storage', type: 'string' },
        { name: 'stock', kind: 'storage', type: 'long' },
      ],
      key: [{ name: 'ID' }],
    },
    {
      name: 'Orders',
      collectionName: 'Orders',
      dataURI: '/rest/Orders',
      attributes: [
        {
          name: 'ID',
          kind: 'storage',
          type: 'long',
          indexed: true,
          unique: true,
          identifying: true,
        },
        { name: 'orderNumber', kind: 'storage', type: 'string', indexed: true, unique: true },
        { name: 'total', kind: 'storage', type: 'number' },
        { name: 'status', kind: 'storage', type: 'string' },
        { name: 'createdAt', kind: 'storage', type: 'date' },
        {
          name: 'user',
          kind: 'relatedEntity',
          type: 'Users',
          inverseName: 'orders',
          foreignKey: 'userId',
        },
      ],
      key: [{ name: 'ID' }],
    },
  ],
}
