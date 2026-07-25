import { expect, test } from '@playwright/test'
import { waitForAppReady } from './helpers/app'
import { DATAEXPLORER_URL } from './helpers/config'

interface LoginResponse {
  success: boolean
  isLogged: boolean
  errors?: string[]
}

test.describe('Login', () => {
  test('should login successfully with access key via API', async ({ page }) => {
    // Make login API request
    const response = await page.request.post(`${DATAEXPLORER_URL}/api/login`, {
      multipart: {
        accessKey: '123',
      },
    })

    // Verify response is OK (200)
    expect(response.ok()).toBeTruthy()

    // Parse and verify the response body
    const body = (await response.json()) as LoginResponse
    expect(body.success).toBeTruthy()
    expect(body.isLogged).toBeTruthy()

    // Navigate to /dataexplorer after successful login
    await page.goto('/dataexplorer/')
    await waitForAppReady(page)

    // Verify we're on the dataexplorer page
    expect(page.url()).toMatch(/\/dataexplorer/)

    // Verify the app is loaded
    const root = page.locator('#root')
    await expect(root).toBeVisible()
  })

  test('should fail login with invalid access key', async ({ page }) => {
    // Make login API request with invalid key
    const response = await page.request.post(`${DATAEXPLORER_URL}/api/login`, {
      multipart: {
        accessKey: 'invalid-key',
      },
    })

    // Verify response is OK (200) - API returns 200 even for invalid tokens
    expect(response.ok()).toBeTruthy()

    // Parse and verify the response body indicates login failed
    const body = (await response.json()) as LoginResponse
    expect(body.success).toBeTruthy()
    expect(body.isLogged).toBeFalsy()
    expect(body.errors).toBeDefined()
    expect(body.errors).toContain('Invalid Access key')
  })
})
