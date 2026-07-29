/**
 * Server Connection settings section (desktop-only).
 * Shows current connection info and allows editing/disconnecting.
 */
import { Button, cn, Input, Label, PasswordInput, Switch } from '@4d/ui'
import { Globe, LogOut, Pencil, Save, ShieldAlert, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  type DesktopConnectionInfo,
  getConnectionStoreAPI,
  isDesktop,
  isMobileShell,
  resetConnectionConfig,
} from '~/lib/platform'

type ServerConnectionSettingsProps = {
  onDisconnect?: () => void
}

export function ServerConnectionSettings({ onDisconnect }: ServerConnectionSettingsProps) {
  const desktop = isDesktop()
  const mobile = isMobileShell()
  const [connection, setConnection] = useState<DesktopConnectionInfo | null>(null)
  const [editing, setEditing] = useState(false)
  const [editUrl, setEditUrl] = useState('')
  const [editName, setEditName] = useState('')
  const [editAccessKey, setEditAccessKey] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editSkipSSL, setEditSkipSSL] = useState(false)
  const [editTimeout, setEditTimeout] = useState('')

  useEffect(() => {
    if (!desktop) return
    const api = getConnectionStoreAPI()
    if (!api) return
    api.getActiveConnection().then((active) => {
      if (active) setConnection(active)
    })
  }, [desktop])

  const startEditing = useCallback(() => {
    if (!connection) return
    setEditUrl(connection.baseUrl)
    setEditName(connection.name)
    setEditAccessKey(connection.accessKey ?? '')
    setEditUsername(connection.username ?? '')
    setEditPassword('')
    setEditSkipSSL(connection.skipSSL ?? false)
    setEditTimeout(connection.timeout?.toString() ?? '')
    setEditing(true)
  }, [connection])

  const handleSave = useCallback(async () => {
    if (!connection) return
    const api = getConnectionStoreAPI()
    if (!api) return
    const updated = await api.saveConnection({
      id: connection.id,
      name: editName.trim() || connection.name,
      baseUrl: editUrl.trim() || connection.baseUrl,
      accessKey: editAccessKey.trim() || undefined,
      username: editUsername.trim() || undefined,
      password: editPassword || undefined,
      skipSSL: editSkipSSL || undefined,
      timeout: editTimeout ? Number.parseInt(editTimeout, 10) : undefined,
      headers: connection.headers,
    })
    setConnection(updated)
    setEditing(false)
    window.location.reload()
  }, [
    connection,
    editUrl,
    editName,
    editAccessKey,
    editUsername,
    editPassword,
    editSkipSSL,
    editTimeout,
  ])

  const handleDisconnect = useCallback(async () => {
    const api = getConnectionStoreAPI()
    if (!api) return
    const active = await api.getActiveConnection()
    if (active?.id && api.clearConnectionCookies) {
      await api.clearConnectionCookies(active.id)
    }
    await api.clearActiveConnection()
    resetConnectionConfig()
    onDisconnect?.()
    window.location.reload()
  }, [onDisconnect])

  // Only render in desktop mode with an active connection
  if (!desktop || !connection) return null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          <Globe className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-sm">Server Connection</h2>
      </div>

      {!editing || mobile ? (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{connection.name}</p>
                <p className="truncate text-muted-foreground text-xs">{connection.baseUrl}</p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {connection.accessKey && (
                    <span className="rounded bg-muted px-1.5 py-0.5">Access Key</span>
                  )}
                  {connection.username && (
                    <span className="rounded bg-muted px-1.5 py-0.5">Basic Auth</span>
                  )}
                  {connection.skipSSL && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      SSL Skipped
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className={cn('flex gap-2', mobile && 'flex-col')}>
            {/* Deep connection editing needs a full keyboard-driven form; on mobile,
                disconnecting and reconnecting is the simpler, less error-prone path. */}
            {!mobile ? (
              <Button variant="outline" size="xs" className="h-6 gap-1 px-2" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
            <Button
              variant="outline"
              size={mobile ? 'default' : 'xs'}
              className={cn(
                'gap-1 border-destructive text-destructive hover:bg-destructive/10',
                mobile ? 'h-11 px-3' : 'h-6 px-2'
              )}
              onClick={handleDisconnect}
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
          {mobile ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              To change the server URL, credentials, or other connection details, disconnect and
              reconnect.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="edit-url" className="text-xs">
              Server URL
            </Label>
            <Input
              id="edit-url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="http://localhost:8044"
              className="h-6 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-xs">
              Name
            </Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-6 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-access-key" className="text-xs">
              Access Key
            </Label>
            <PasswordInput
              id="edit-access-key"
              autoComplete="off"
              value={editAccessKey}
              onChange={(e) => setEditAccessKey(e.target.value)}
              placeholder="Leave blank to keep current"
              className="h-6 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Username</Label>
              <Input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="h-6 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <PasswordInput
                autoComplete="off"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep"
                className="h-6 text-xs"
              />
            </div>
          </div>
          <div
            className={cn(
              'rounded-md border px-2.5 py-2 transition-colors',
              editSkipSSL
                ? 'border-amber-500/35 bg-amber-500/[0.06]'
                : 'border-border/80 bg-transparent'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="edit-ssl" className="cursor-pointer text-xs">
                  Skip SSL verification
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Allow self-signed, expired, or hostname-mismatched certificates
                </p>
              </div>
              <Switch
                id="edit-ssl"
                checked={editSkipSSL}
                onCheckedChange={setEditSkipSSL}
                className="shrink-0"
              />
            </div>
            {editSkipSSL ? (
              <p className="mt-1.5 flex items-start gap-1.5 border-amber-500/20 border-t pt-1.5 text-[11px] text-amber-800 leading-relaxed dark:text-amber-200/90">
                <ShieldAlert
                  className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300"
                  aria-hidden="true"
                />
                <span>
                  Still encrypted — we just stop checking who signed the keys. Prefer local/lab
                  hosts, not production.
                </span>
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Timeout (ms)</Label>
            <Input
              type="number"
              value={editTimeout}
              onChange={(e) => setEditTimeout(e.target.value)}
              placeholder="30000"
              className="h-6 text-xs"
              min="1000"
            />
          </div>
          <div className="flex gap-2">
            <Button size="xs" className="h-6 gap-1 px-2" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save & Reconnect
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 gap-1 px-2"
              onClick={() => setEditing(false)}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
