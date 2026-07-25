import type { Page } from '@playwright/test'
import { createLoginPage } from '../pages'
import { applyE2ESettings } from './settings'

/**
 * Login helper function
 * Sends a POST request to /api/login with the access key and navigates to /dataexplorer on success
 */
export async function login(page: Page, accessKey = '123'): Promise<void> {
  await createLoginPage(page).loginViaApi(accessKey)
  await applyE2ESettings(page)
}
