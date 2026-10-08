package com.konpdf.scan

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.OptionalModuleApi
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.konpdf.files.CacheFiles
import com.konpdf.specs.NativeScanSpec
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * The Scan tab's native side (src/native/NativeScan.ts):
 *
 *  - Google's document scanner (ML Kit, through Play services): camera, edge
 *    detection, crop and clean-up, all in Google's own screen. No camera
 *    permission is needed and nothing is added to the APK.
 *  - Google's text reader (ML Kit Text Recognition v2) for Latin and
 *    Devanagari scripts, on the phone. Its models also come from Play
 *    services and are fetched the first time they are needed.
 *  - Page plumbing: PDF pages to pictures, upright resized copies, pictures
 *    to a PDF, text files and the clipboard.
 */
class ScanModule(reactContext: ReactApplicationContext) :
    NativeScanSpec(reactContext), ActivityEventListener {

  private var pendingScan: Promise? = null
  private val io = Executors.newCachedThreadPool()

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = NAME

  // --------------------------------------------------------------- scanner

  override fun isScannerAvailable(promise: Promise) {
    val status = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(reactApplicationContext)
    promise.resolve(status == ConnectionResult.SUCCESS)
  }

  override fun scanDocument(pageLimit: Double, allowGallery: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(ERROR_FAILED, "KonPDF isn't in the foreground")
      return
    }
    if (pendingScan != null) {
      promise.reject(ERROR_BUSY, "Already scanning")
      return
    }
    val options =
        GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(allowGallery)
            .setPageLimit(pageLimit.toInt().coerceIn(1, 100))
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG, GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()
    pendingScan = promise
    try {
      GmsDocumentScanning.getClient(options)
          .getStartScanIntent(activity)
          .addOnSuccessListener { sender ->
            try {
              activity.startIntentSenderForResult(sender, REQUEST_SCAN, null, 0, 0, 0)
            } catch (e: Throwable) {
              Log.e(TAG, "Scanner didn't open", e)
              pendingScan = null
              promise.reject(ERROR_SCANNER_UNAVAILABLE, e.message ?: "The scanner didn't open", e)
            }
          }
          .addOnFailureListener { e ->
            Log.e(TAG, "Scanner unavailable", e)
            pendingScan = null
            promise.reject(ERROR_SCANNER_UNAVAILABLE, e.message ?: "The scanner isn't available", e)
          }
    } catch (e: Throwable) {
      Log.e(TAG, "Scanner failed to start", e)
      pendingScan = null
      promise.reject(ERROR_SCANNER_UNAVAILABLE, e.message ?: "The scanner isn't available", e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_SCAN) return
    val promise = pendingScan ?: return
    pendingScan = null
    val result = if (resultCode == Activity.RESULT_OK) GmsDocumentScanningResult.fromActivityResultIntent(data) else null
    if (result == null) {
      promise.resolve("")
      return
    }
    io.execute {
      try {
        val stamp = SimpleDateFormat("yyyy-MM-dd HH.mm", Locale.US).format(Date())
        val pages = JSONArray()
        result.pages?.forEachIndexed { i, page ->
          pages.put(copyIn(page.imageUri, "scans", "Scan $stamp - ${i + 1}.jpg", "image/jpeg"))
        }
        val pdf = result.pdf?.let { copyIn(it.uri, "scans", "Scan $stamp.pdf", "application/pdf") }
        promise.resolve(JSONObject().put("pages", pages).put("pdf", pdf ?: JSONObject.NULL).toString())
      } catch (e: Throwable) {
        Log.e(TAG, "Couldn't keep the scan", e)
        promise.reject(ERROR_FAILED, e.message ?: "Couldn't keep the scan", e)
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  // ----------------------------------------------------------- text reader

  override fun recognizeText(path: String, script: String, promise: Promise) {
    io.execute {
      var recognizer: TextRecognizer? = null
      try {
        recognizer =
            if (script == "devanagari") TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
            else TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        ensureInstalled(recognizer)
        val image = InputImage.fromFilePath(reactApplicationContext, Uri.fromFile(File(path)))
        val text = Tasks.await(recognizer.process(image), 2, TimeUnit.MINUTES)
        val blocks = JSONArray()
        for (block in text.textBlocks) {
          val lines = JSONArray()
          for (line in block.lines) {
            lines.put(
                JSONObject()
                    .put("text", line.text)
                    .put("box", box(line.boundingBox)))
          }
          blocks.put(JSONObject().put("text", block.text).put("box", box(block.boundingBox)).put("lines", lines))
        }
        promise.resolve(
            JSONObject()
                .put("text", text.text)
                .put("width", image.width)
                .put("height", image.height)
                .put("blocks", blocks)
                .toString())
      } catch (e: Throwable) {
        Log.e(TAG, "Text reader failed", e)
        val cause = (e.cause as? MlKitException) ?: (e as? MlKitException)
        if (cause?.errorCode == MlKitException.UNAVAILABLE) {
          promise.reject(ERROR_READER_UNAVAILABLE, cause.message ?: "The text reader isn't ready yet", e)
        } else {
          promise.reject(ERROR_FAILED, e.message ?: "Couldn't read the text", e)
        }
      } finally {
        runCatching { recognizer?.close() }
      }
    }
  }

  /** Fetches the reader's model through Play services the first time (a few MB). */
  private fun ensureInstalled(recognizer: TextRecognizer) {
    val api = recognizer as? OptionalModuleApi ?: return
    val client = ModuleInstall.getClient(reactApplicationContext)
    if (Tasks.await(client.areModulesAvailable(api), 30, TimeUnit.SECONDS).areModulesAvailable()) return
    Tasks.await(client.installModules(ModuleInstallRequest.newBuilder().addApi(api).build()), 30, TimeUnit.SECONDS)
    val deadline = System.currentTimeMillis() + 120_000
    while (System.currentTimeMillis() < deadline) {
      Thread.sleep(1000)
      if (Tasks.await(client.areModulesAvailable(api), 30, TimeUnit.SECONDS).areModulesAvailable()) return
    }
    throw MlKitException("The text reader is still downloading", MlKitException.UNAVAILABLE)
  }

  private fun box(rect: Rect?): JSONArray =
      if (rect == null) JSONArray()
      else JSONArray().put(rect.left).put(rect.top).put(rect.right).put(rect.bottom)

  // -------------------------------------------------------- page plumbing

  override fun pdfPageCount(path: String, promise: Promise) {
    io.execute {
      try {
        openPdf(path).use { promise.resolve(it.pageCount.toDouble()) }
      } catch (e: SecurityException) {
        promise.reject(ERROR_PDF_LOCKED, "This PDF has a password", e)
      } catch (e: Throwable) {
        Log.e(TAG, "Couldn't open the PDF", e)
        promise.reject(ERROR_UNREADABLE, e.message ?: "Couldn't open the PDF", e)
      }
    }
  }

  override fun renderPdfPage(path: String, index: Double, maxSide: Double, promise: Promise) {
    io.execute {
      try {
        openPdf(path).use { renderer ->
          renderer.openPage(index.toInt()).use { page ->
            val scale = maxSide / maxOf(page.width, page.height)
            val bitmap =
                Bitmap.createBitmap(
                    (page.width * scale).toInt().coerceAtLeast(1),
                    (page.height * scale).toInt().coerceAtLeast(1),
                    Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
            val stem = File(path).nameWithoutExtension
            val target = CacheFiles.newFile(reactApplicationContext, "pages", "$stem - page ${index.toInt() + 1}.jpg")
            target.writeBytes(CacheFiles.jpeg(bitmap, 92))
            bitmap.recycle()
            promise.resolve(CacheFiles.describe(target, mime = "image/jpeg").toString())
          }
        }
      } catch (e: SecurityException) {
        promise.reject(ERROR_PDF_LOCKED, "This PDF has a password", e)
      } catch (e: Throwable) {
        Log.e(TAG, "Couldn't read the page", e)
        promise.reject(ERROR_UNREADABLE, e.message ?: "Couldn't read the page", e)
      }
    }
  }

  override fun scaleImage(path: String, maxSide: Double, promise: Promise) {
    io.execute {
      try {
        val bitmap = CacheFiles.decodeUpright(path, maxSide.toInt())
        if (bitmap == null) {
          promise.reject(ERROR_UNREADABLE, "Android can't read this picture")
          return@execute
        }
        val target = CacheFiles.newFile(reactApplicationContext, "pages", File(path).nameWithoutExtension + ".jpg")
        target.writeBytes(CacheFiles.jpeg(bitmap, 92))
        bitmap.recycle()
        promise.resolve(CacheFiles.describe(target, mime = "image/jpeg").toString())
      } catch (e: OutOfMemoryError) {
        promise.reject(ERROR_UNREADABLE, "This picture is too big", e)
      } catch (e: Throwable) {
        Log.e(TAG, "Couldn't read the picture", e)
        promise.reject(ERROR_UNREADABLE, e.message ?: "Couldn't read the picture", e)
      }
    }
  }

  override fun makePdf(paths: ReadableArray, fileName: String, promise: Promise) {
    io.execute {
      try {
        val pages =
            (0 until paths.size()).mapNotNull { paths.getString(it) }.map { path ->
              val bitmap = CacheFiles.decodeUpright(path, PDF_MAX_SIDE) ?: throw IllegalStateException("Can't read $path")
              JpegPdf.Page(CacheFiles.jpeg(bitmap, 85), bitmap.width, bitmap.height).also { bitmap.recycle() }
            }
        if (pages.isEmpty()) {
          promise.reject(ERROR_FAILED, "No pages")
          return@execute
        }
        val target = CacheFiles.newFile(reactApplicationContext, "scans", fileName)
        JpegPdf.write(pages, target)
        promise.resolve(CacheFiles.describe(target, mime = "application/pdf").toString())
      } catch (e: OutOfMemoryError) {
        promise.reject(ERROR_FAILED, "Too many pages at once", e)
      } catch (e: Throwable) {
        Log.e(TAG, "Couldn't make the PDF", e)
        promise.reject(ERROR_FAILED, e.message ?: "Couldn't make the PDF", e)
      }
    }
  }

  override fun writeText(text: String, fileName: String, promise: Promise) {
    io.execute {
      try {
        val target = CacheFiles.newFile(reactApplicationContext, "text", fileName)
        target.writeText(text, Charsets.UTF_8)
        val mime = if (fileName.endsWith(".csv")) "text/csv" else "text/plain"
        promise.resolve(CacheFiles.describe(target, mime = mime).toString())
      } catch (e: Exception) {
        promise.reject(ERROR_FAILED, e.message ?: "Couldn't write the file", e)
      }
    }
  }

  override fun copyText(text: String, promise: Promise) {
    val context = reactApplicationContext
    val copy = Runnable {
      try {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("KonPDF", text))
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject(ERROR_FAILED, e.message ?: "Couldn't copy", e)
      }
    }
    context.currentActivity?.runOnUiThread(copy) ?: copy.run()
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdown()
    super.invalidate()
  }

  // ---------------------------------------------------------------- helpers

  private fun openPdf(path: String) =
      PdfRenderer(ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY))

  private fun copyIn(uri: Uri, kind: String, name: String, mime: String): JSONObject {
    val target = CacheFiles.newFile(reactApplicationContext, kind, name)
    val input = reactApplicationContext.contentResolver.openInputStream(uri) ?: throw IllegalStateException("Scan missing")
    input.use { i -> target.outputStream().use { i.copyTo(it) } }
    return CacheFiles.describe(target, name, mime)
  }

  companion object {
    const val NAME = "KonScan"
    private const val TAG = "KonScan"
    private const val REQUEST_SCAN = 5130
    /** Pages made into a PDF on the phone: sharp enough to print, small enough to send. */
    private const val PDF_MAX_SIDE = 2200
    private const val ERROR_FAILED = "failed"
    private const val ERROR_BUSY = "busy"
    private const val ERROR_SCANNER_UNAVAILABLE = "scanner_unavailable"
    private const val ERROR_READER_UNAVAILABLE = "reader_unavailable"
    private const val ERROR_PDF_LOCKED = "pdf_locked"
    private const val ERROR_UNREADABLE = "unreadable"
  }
}
