package com.plugin.savebytes

import android.app.Activity
import android.content.ContentValues
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

@InvokeArg
class SaveToDownloadsArgs {
  lateinit var filename: String
  var mimeType: String? = null
  lateinit var sourcePath: String
}

@InvokeArg
class WriteToUriArgs {
  lateinit var uri: String
  lateinit var sourcePath: String
}

/**
 * Writes files through Android's ContentResolver so Downloads / SAF documents
 * get a correct byte length. Tauri's fs plugin detachFd() path finalizes
 * content:// providers as 0-byte files (plugins-workspace#3356).
 */
@TauriPlugin
class SaveBytesPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun saveToDownloads(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(SaveToDownloadsArgs::class.java)
      val source = File(args.sourcePath)
      if (!source.isFile) {
        throw Error("Source file does not exist: ${args.sourcePath}")
      }
      val mime = args.mimeType?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
      val displayName = args.filename.substringAfterLast('/').ifBlank { "download.bin" }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        saveViaMediaStore(source, displayName, mime)
      } else {
        saveViaPublicDownloads(source, displayName)
      }

      invoke.resolve(JSObject())
    } catch (t: Throwable) {
      invoke.reject(t.message ?: "Failed to save to Downloads")
    }
  }

  @Command
  fun writeToUri(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(WriteToUriArgs::class.java)
      val source = File(args.sourcePath)
      if (!source.isFile) {
        throw Error("Source file does not exist: ${args.sourcePath}")
      }
      copyFileToUri(source, Uri.parse(args.uri))
      invoke.resolve(JSObject())
    } catch (t: Throwable) {
      invoke.reject(t.message ?: "Failed to write to URI")
    }
  }

  private fun saveViaMediaStore(source: File, displayName: String, mime: String) {
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, displayName)
      put(MediaStore.Downloads.MIME_TYPE, mime)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }
    val resolver = activity.contentResolver
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    val uri = resolver.insert(collection, values)
      ?: throw Error("MediaStore insert failed for $displayName")

    try {
      copyFileToUri(source, uri)
      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
    } catch (t: Throwable) {
      resolver.delete(uri, null, null)
      throw t
    }
  }

  private fun saveViaPublicDownloads(source: File, displayName: String) {
    val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    if (!dir.exists() && !dir.mkdirs()) {
      throw Error("Cannot create Downloads directory")
    }
    val dest = uniqueFile(dir, displayName)
    FileInputStream(source).use { input ->
      FileOutputStream(dest).use { output ->
        input.copyTo(output)
      }
    }
    MediaScannerConnection.scanFile(
      activity,
      arrayOf(dest.absolutePath),
      null,
      null
    )
  }

  private fun copyFileToUri(source: File, destUri: Uri) {
    val outputStream = activity.contentResolver.openOutputStream(destUri, "wt")
      ?: activity.contentResolver.openOutputStream(destUri)
      ?: throw Error("Cannot open output stream for URI: $destUri")
    outputStream.use { output ->
      FileInputStream(source).use { input ->
        input.copyTo(output)
      }
      output.flush()
    }
  }

  private fun uniqueFile(dir: File, displayName: String): File {
    val candidate = File(dir, displayName)
    if (!candidate.exists()) return candidate
    val dot = displayName.lastIndexOf('.')
    val base = if (dot > 0) displayName.substring(0, dot) else displayName
    val ext = if (dot > 0) displayName.substring(dot) else ""
    var i = 1
    while (true) {
      val next = File(dir, "$base ($i)$ext")
      if (!next.exists()) return next
      i += 1
    }
  }
}
