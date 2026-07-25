import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileArchive,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'
import { Checkbox } from './checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Input } from './input'
import { Label } from './label'

export type RestoreDbOptions = {
  targetDatabase?: string
  drop: boolean
  dryRun: boolean
  noIndexRestore: boolean
  stopOnError: boolean
  numInsertionWorkers?: number
  preserveUUIDs: boolean
  oplogReplay: boolean
}

export type RestoreDbResult = {
  success: boolean
  message: string
  output?: string
}

export type RestoreDbModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Check if mongorestore is available */
  onCheckAvailability: () => Promise<{ available: boolean }>
  /** Execute the restore */
  onRestore: (file: File, options: RestoreDbOptions) => Promise<RestoreDbResult>
  /** Current database name (for display) */
  currentDatabase?: string
}

export function RestoreDbModal({
  open,
  onOpenChange,
  onCheckAvailability,
  onRestore,
  currentDatabase = 'current database',
}: RestoreDbModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [result, setResult] = useState<RestoreDbResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [options, setOptions] = useState<RestoreDbOptions>({
    targetDatabase: '',
    drop: true,
    dryRun: false,
    noIndexRestore: false,
    stopOnError: true,
    numInsertionWorkers: undefined,
    preserveUUIDs: false,
    oplogReplay: false,
  })

  // Check availability when modal opens
  const checkAvailability = useCallback(async () => {
    setIsChecking(true)
    setError(null)
    try {
      const { available } = await onCheckAvailability()
      setIsAvailable(available)
      if (!available) {
        setError('mongorestore is not available on this server')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check availability')
      setIsAvailable(false)
    } finally {
      setIsChecking(false)
    }
  }, [onCheckAvailability])

  // Check availability when modal opens via prop
  useEffect(() => {
    if (open && isAvailable === null && !isChecking) {
      checkAvailability()
    }
  }, [open, isAvailable, isChecking, checkAvailability])

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setFile(null)
        setResult(null)
        setError(null)
        setIsAvailable(null) // Reset so it checks again next time
        setOptions({
          targetDatabase: '',
          drop: true,
          dryRun: false,
          noIndexRestore: false,
          stopOnError: true,
          numInsertionWorkers: undefined,
          preserveUUIDs: false,
          oplogReplay: false,
        })
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setResult(null)
  }, [])

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        const validTypes = ['.tar.gz', '.tgz', '.gz']
        const isValid = validTypes.some((ext) => droppedFile.name.endsWith(ext))
        if (isValid) {
          handleFileSelect(droppedFile)
        } else {
          setError('Invalid file type. Expected a .tar.gz, .tgz, or .gz dump file.')
        }
      }
    },
    [handleFileSelect]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileSelect(selectedFile)
      }
    },
    [handleFileSelect]
  )

  const handleRestore = useCallback(async () => {
    if (!file) return

    setIsRestoring(true)
    setError(null)
    setResult(null)

    try {
      const restoreResult = await onRestore(file, options)
      setResult(restoreResult)
      if (!restoreResult.success) {
        setError(restoreResult.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setIsRestoring(false)
    }
  }, [file, options, onRestore])

  const resetForm = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="sticky top-0 z-10 shrink-0 border-b bg-background px-4 py-3">
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Restore Database
          </DialogTitle>
          <DialogDescription>
            Upload a database dump file and configure restore options
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {/* Availability Check */}
          {isChecking && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking mongorestore availability...
            </div>
          )}

          {isAvailable === false && !isChecking && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              mongorestore is not available on this server. Please install MongoDB tools.
            </div>
          )}

          {isAvailable && !result && (
            <>
              {/* File Upload */}
              <div className="space-y-2">
                <Label>Dump File</Label>
                <label
                  className={cn(
                    'relative block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors',
                    file
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".tar.gz,.tgz,.gz"
                    onChange={handleFileInputChange}
                    className="sr-only"
                  />

                  {file ? (
                    <div className="space-y-2">
                      <FileArchive className="mx-auto h-10 w-10 text-primary" />
                      <p className="font-medium">{file.name}</p>
                      <p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          resetForm()
                        }}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Drop a dump file here</p>
                      <p className="text-muted-foreground text-sm">
                        Accepts .tar.gz, .tgz, or .gz files
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Options */}
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <h3 className="font-semibold text-sm">Restore Options</h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Target Database */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="targetDatabase">Target Database (optional)</Label>
                    <Input
                      id="targetDatabase"
                      type="text"
                      placeholder={`Leave empty to restore to ${currentDatabase}`}
                      value={options.targetDatabase}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, targetDatabase: e.target.value }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      Specify a different database name to restore to, or leave empty to use the
                      current database.
                    </p>
                  </div>

                  {/* Drop Collections */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="drop"
                        checked={options.drop}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({ ...prev, drop: checked === true }))
                        }
                      />
                      <Label htmlFor="drop" className="cursor-pointer font-medium text-sm">
                        Drop collections
                      </Label>
                    </div>
                    <p className="ml-6 text-muted-foreground text-xs">
                      Drop existing collections before restoring (--drop)
                    </p>
                  </div>

                  {/* Dry Run */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dryRun"
                        checked={options.dryRun}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({ ...prev, dryRun: checked === true }))
                        }
                      />
                      <Label htmlFor="dryRun" className="cursor-pointer font-medium text-sm">
                        Dry run
                      </Label>
                    </div>
                    <p className="ml-6 text-muted-foreground text-xs">
                      Preview restore without making changes (--dryRun)
                    </p>
                  </div>

                  {/* Stop on Error */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="stopOnError"
                        checked={options.stopOnError}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({ ...prev, stopOnError: checked === true }))
                        }
                      />
                      <Label htmlFor="stopOnError" className="cursor-pointer font-medium text-sm">
                        Stop on error
                      </Label>
                    </div>
                    <p className="ml-6 text-muted-foreground text-xs">
                      Stop restore on first error (--stopOnError)
                    </p>
                  </div>

                  {/* No Index Restore */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="noIndexRestore"
                        checked={options.noIndexRestore}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({ ...prev, noIndexRestore: checked === true }))
                        }
                      />
                      <Label
                        htmlFor="noIndexRestore"
                        className="cursor-pointer font-medium text-sm"
                      >
                        Skip indexes
                      </Label>
                    </div>
                    <p className="ml-6 text-muted-foreground text-xs">
                      Skip index restoration (--noIndexRestore)
                    </p>
                  </div>

                  {/* Preserve UUIDs */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="preserveUUIDs"
                        checked={options.preserveUUIDs}
                        onCheckedChange={(checked) =>
                          setOptions((prev) => ({ ...prev, preserveUUIDs: checked === true }))
                        }
                      />
                      <Label htmlFor="preserveUUIDs" className="cursor-pointer font-medium text-sm">
                        Preserve UUIDs
                      </Label>
                    </div>
                    <p className="ml-6 text-muted-foreground text-xs">
                      Preserve collection UUIDs (--preserveUUIDs)
                    </p>
                  </div>

                  {/* Parallel Workers */}
                  <div className="space-y-2">
                    <Label htmlFor="numInsertionWorkers">Parallel Workers</Label>
                    <Input
                      id="numInsertionWorkers"
                      type="number"
                      min={1}
                      max={64}
                      placeholder="Default (4)"
                      value={options.numInsertionWorkers ?? ''}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          numInsertionWorkers: e.target.value
                            ? parseInt(e.target.value, 10)
                            : undefined,
                        }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      Number of parallel insertion workers per collection
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              {options.drop && !options.dryRun && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="text-sm">
                    <strong>Warning:</strong> This will drop existing collections in{' '}
                    <code className="rounded bg-amber-200/50 px-1 text-xs dark:bg-amber-800/50">
                      {options.targetDatabase || currentDatabase}
                    </code>{' '}
                    before restoring. This action cannot be undone.
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}

          {/* Result */}
          {result && (
            <div
              className={cn(
                'rounded-lg p-4',
                result.success ? 'bg-green-500/10' : 'bg-destructive/10'
              )}
            >
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <p className="font-medium">{result.message}</p>
              </div>

              {result.output && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded border bg-background p-2">
                  <pre className="whitespace-pre-wrap text-muted-foreground text-xs">
                    {result.output}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-4 py-3">
          {result ? (
            <>
              <Button variant="ghost" onClick={resetForm}>
                Restore Another
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRestore}
                disabled={!file || !isAvailable || isRestoring}
                className="gap-2"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {options.dryRun ? 'Running...' : 'Restoring...'}
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    {options.dryRun ? 'Preview Restore' : 'Restore Database'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
