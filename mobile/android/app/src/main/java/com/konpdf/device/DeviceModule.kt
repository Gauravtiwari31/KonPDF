package com.konpdf.device

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.konpdf.specs.NativeDeviceSpec
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Everything KonPDF needs from Android for files (src/native/NativeDevice.ts):
 * picking them, receiving them from other apps' share sheets, downloading the
 * engine's results, and saving, sharing or opening those results.
 *
 * All work happens on copies inside the app's cache folder, so no storage
 * permission is ever needed: Android's own pickers (the Storage Access
 * Framework) hand over one file at a time. File lists cross to JavaScript as
 * JSON strings: [{ uri, path, name, mime, size }].
 */
class DeviceModule(reactContext: ReactApplicationContext) :
    NativeDeviceSpec(reactContext), ActivityEventListener {

  private class PendingPick(val promise: Promise)

  private class PendingSave(val source: File, val promise: Promise)

  private var pendingPick: PendingPick? = null
  private var pendingSave: PendingSave? = null
  private val io = Executors.newCachedThreadPool()

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = NAME

  // ---------------------------------------------------------------- picking

  override fun pickFiles(mimeTypes: ReadableArray, multiple: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(ERROR_FAILED, "KonPDF isn't in the foreground")
      return
    }
    if (pendingPick != null) {
      promise.reject(ERROR_BUSY, "Already picking files")
      return
    }
    val types = (0 until mimeTypes.size()).mapNotNull { mimeTypes.getString(it) }
    val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(if (types.size == 1) types[0] else "*/*")
            .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
    if (types.size > 1) {
      intent.putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
    }
    pendingPick = PendingPick(promise)
    try {
      activity.startActivityForResult(intent, REQUEST_PICK)
    } catch (e: ActivityNotFoundException) {
      pendingPick = null
      promise.reject(ERROR_FAILED, "This phone has no screen for choosing files", e)
    }
  }

  /**
   * Files another app shared to KonPDF (Android share sheet). Each share is
   * handed out once: the intent is marked as used afterwards.
   */
  override fun takeSharedFiles(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    val intent = activity?.intent
    if (intent == null || intent.getBooleanExtra(EXTRA_CONSUMED, false)) {
      promise.resolve("[]")
      return
    }
    val uris =
        when (intent.action) {
          Intent.ACTION_SEND -> listOfNotNull(intent.streamExtra())
          Intent.ACTION_SEND_MULTIPLE -> intent.streamListExtra()
          Intent.ACTION_VIEW -> listOfNotNull(intent.data)
          else -> emptyList()
        }
    intent.putExtra(EXTRA_CONSUMED, true)
    if (uris.isEmpty()) {
      promise.resolve("[]")
      return
    }
    copyAll(uris, promise)
  }

  // ------------------------------------------------------------ downloading

  override fun downloadFile(url: String, fileName: String, headersJson: String, promise: Promise) {
    io.execute {
      var connection: HttpURLConnection? = null
      try {
        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 30_000
          readTimeout = 120_000
          val headers = JSONObject(headersJson.ifBlank { "{}" })
          headers.keys().forEach { setRequestProperty(it, headers.getString(it)) }
        }
        val status = connection.responseCode
        if (status >= 400) {
          val body = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
          promise.reject("http_$status", body)
          return@execute
        }
        val target = newCacheFile("results", fileName)
        connection.inputStream.use { input -> target.outputStream().use { input.copyTo(it) } }
        val mime =
            connection.contentType?.substringBefore(';')?.trim()?.takeIf { it.isNotEmpty() }
                ?: mimeFromName(fileName)
        promise.resolve(describe(target, fileName, mime).toString())
      } catch (e: Exception) {
        promise.reject(ERROR_NETWORK, e.message ?: "Download failed", e)
      } finally {
        connection?.disconnect()
      }
    }
  }

  // ------------------------------------------------- saving, sharing, opening

  override fun saveFile(path: String, fileName: String, mimeType: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    val source = File(path)
    if (activity == null) {
      promise.reject(ERROR_FAILED, "KonPDF isn't in the foreground")
      return
    }
    if (!source.isFile) {
      promise.reject(ERROR_MISSING, "That file is no longer on this phone")
      return
    }
    if (pendingSave != null) {
      promise.reject(ERROR_BUSY, "Already saving a file")
      return
    }
    val intent =
        Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mimeType)
            .putExtra(Intent.EXTRA_TITLE, fileName)
    pendingSave = PendingSave(source, promise)
    try {
      activity.startActivityForResult(intent, REQUEST_SAVE)
    } catch (e: ActivityNotFoundException) {
      pendingSave = null
      promise.reject(ERROR_FAILED, "This phone has no screen for saving files", e)
    }
  }

  override fun shareFiles(paths: ReadableArray, mimeType: String, promise: Promise) {
    try {
      val context = reactApplicationContext
      val uris = ArrayList((0 until paths.size()).mapNotNull { paths.getString(it) }.map { contentUri(context, File(it)) })
      if (uris.isEmpty()) {
        promise.reject(ERROR_MISSING, "Nothing to share")
        return
      }
      val send =
          if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
          } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
          }
      send.setType(mimeType).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      // Lets the receiving app read every file, not just the first.
      send.clipData = ClipData.newRawUri(null, uris[0]).apply { uris.drop(1).forEach { addItem(ClipData.Item(it)) } }
      start(Intent.createChooser(send, null))
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject(ERROR_FAILED, e.message ?: "Couldn't share", e)
    }
  }

  override fun openFile(path: String, mimeType: String, promise: Promise) {
    try {
      val uri = contentUri(reactApplicationContext, File(path))
      val view =
          Intent(Intent.ACTION_VIEW)
              .setDataAndType(uri, mimeType)
              .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      start(Intent.createChooser(view, null))
      promise.resolve(null)
    } catch (e: ActivityNotFoundException) {
      promise.reject(ERROR_NO_APP, "No app on this phone can open this file", e)
    } catch (e: Exception) {
      promise.reject(ERROR_FAILED, e.message ?: "Couldn't open the file", e)
    }
  }

  override fun deleteFile(path: String, promise: Promise) {
    val file = File(path)
    // Only ever deletes KonPDF's own copies.
    if (file.canonicalPath.startsWith(reactApplicationContext.cacheDir.canonicalPath)) {
      file.parentFile?.takeIf { it.name.length == 36 }?.deleteRecursively() ?: file.delete()
    }
    promise.resolve(null)
  }

  // --------------------------------------------------------- activity results

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    when (requestCode) {
      REQUEST_PICK -> {
        val pick = pendingPick ?: return
        pendingPick = null
        if (resultCode != Activity.RESULT_OK || data == null) {
          pick.promise.resolve("[]")
          return
        }
        val uris = mutableListOf<Uri>()
        data.clipData?.let { clip -> (0 until clip.itemCount).forEach { uris.add(clip.getItemAt(it).uri) } }
        if (uris.isEmpty()) data.data?.let { uris.add(it) }
        copyAll(uris, pick.promise)
      }
      REQUEST_SAVE -> {
        val save = pendingSave ?: return
        pendingSave = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
          save.promise.resolve(false)
          return
        }
        io.execute {
          try {
            val out = activity.contentResolver.openOutputStream(uri) ?: throw IllegalStateException("Couldn't open the file")
            out.use { stream -> save.source.inputStream().use { it.copyTo(stream) } }
            save.promise.resolve(true)
          } catch (e: Exception) {
            save.promise.reject(ERROR_FAILED, e.message ?: "Couldn't write the file", e)
          }
        }
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdown()
    super.invalidate()
  }

  // ---------------------------------------------------------------- helpers

  /** Copies content:// files into the cache (off the UI thread) and describes them. */
  private fun copyAll(uris: List<Uri>, promise: Promise) {
    io.execute {
      try {
        val resolver = reactApplicationContext.contentResolver
        val result = JSONArray()
        for (uri in uris) {
          var name = "file"
          resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst() && !c.isNull(0)) name = c.getString(0)
          }
          if (uri.scheme == "file") name = uri.lastPathSegment ?: name
          val target = newCacheFile("picked", name)
          val input = resolver.openInputStream(uri) ?: continue
          input.use { i -> target.outputStream().use { i.copyTo(it) } }
          val mime = resolver.getType(uri) ?: mimeFromName(name)
          result.put(describe(target, name, mime))
        }
        promise.resolve(result.toString())
      } catch (e: Exception) {
        promise.reject(ERROR_FAILED, e.message ?: "Couldn't read the file", e)
      }
    }
  }

  /** cache/<kind>/<uuid>/<name>: a folder per file keeps original names without clashes. */
  private fun newCacheFile(kind: String, name: String): File {
    val safe = name.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").take(150).ifBlank { "file" }
    val dir = File(File(reactApplicationContext.cacheDir, kind), UUID.randomUUID().toString())
    dir.mkdirs()
    return File(dir, safe)
  }

  private fun describe(file: File, name: String, mime: String) =
      JSONObject()
          .put("uri", Uri.fromFile(file).toString())
          .put("path", file.absolutePath)
          .put("name", name)
          .put("mime", mime)
          .put("size", file.length())

  private fun mimeFromName(name: String): String =
      MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase())
          ?: "application/octet-stream"

  private fun contentUri(context: Context, file: File): Uri =
      FileProvider.getUriForFile(context, "${context.packageName}.files", file)

  private fun start(intent: Intent) {
    val activity = reactApplicationContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      reactApplicationContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  @Suppress("DEPRECATION")
  private fun Intent.streamExtra(): Uri? =
      if (Build.VERSION.SDK_INT >= 33) getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else getParcelableExtra(Intent.EXTRA_STREAM)

  @Suppress("DEPRECATION")
  private fun Intent.streamListExtra(): List<Uri> =
      (if (Build.VERSION.SDK_INT >= 33) getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)) ?: emptyList()

  companion object {
    const val NAME = "KonDevice"
    private const val REQUEST_PICK = 5120
    private const val REQUEST_SAVE = 5121
    private const val EXTRA_CONSUMED = "com.konpdf.SHARE_CONSUMED"
    private const val ERROR_FAILED = "failed"
    private const val ERROR_BUSY = "busy"
    private const val ERROR_MISSING = "missing"
    private const val ERROR_NO_APP = "no_app"
    private const val ERROR_NETWORK = "network"
  }
}
