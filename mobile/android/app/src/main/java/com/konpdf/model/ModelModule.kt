package com.konpdf.model

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.StatFs
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.konpdf.specs.NativeModelSpec
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Developer Mode's model files (src/native/NativeModel.ts).
 *
 * Files download into the app's private storage (files/models), so they
 * need no permission and leave with the app. A download continues where it
 * stopped (HTTP Range) and the finished file is checked against its SHA-256
 * before it is used: a half-written model would crash the reader.
 */
class ModelModule(reactContext: ReactApplicationContext) : NativeModelSpec(reactContext) {

  private class Status(
      @Volatile var state: String,
      @Volatile var bytes: Long,
      @Volatile var total: Long,
      @Volatile var error: String? = null,
  )

  private val statuses = ConcurrentHashMap<String, Status>()
  private val stops = ConcurrentHashMap<String, AtomicBoolean>()
  private val io = Executors.newFixedThreadPool(2)

  private val dir: File
    get() = File(reactApplicationContext.filesDir, "models").apply { mkdirs() }

  override fun getName() = NAME

  // ---------------------------------------------------------------- device

  override fun deviceInfo(promise: Promise) {
    val context = reactApplicationContext
    val memory = ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
    val gms = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    promise.resolve(
        JSONObject()
            .put("is64Bit", Build.SUPPORTED_64_BIT_ABIS.isNotEmpty())
            .put("abis", JSONArray(Build.SUPPORTED_ABIS.toList()))
            .put("ramMb", memory.totalMem / MB)
            .put("availableRamMb", memory.availMem / MB)
            .put("freeStorageMb", StatFs(context.filesDir.absolutePath).availableBytes / MB)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("onUnmeteredNetwork", isUnmetered())
            .put("playServices", gms)
            .put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
            .toString())
  }

  private fun isUnmetered(): Boolean {
    val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
  }

  // ------------------------------------------------------------- downloads

  override fun startDownload(
      url: String,
      fileName: String,
      sha256: String,
      size: Double,
      wifiOnly: Boolean,
      promise: Promise,
  ) {
    val current = statuses[fileName]
    if (current != null && (current.state == "running" || current.state == "verifying")) {
      promise.resolve(null)
      return
    }
    val total = size.toLong()
    val target = File(dir, safe(fileName))
    if (target.isFile) {
      statuses[fileName] = Status("done", target.length(), target.length())
      promise.resolve(null)
      return
    }
    val part = File(dir, safe(fileName) + ".part")
    val status = Status("running", part.length(), total)
    statuses[fileName] = status
    val stop = AtomicBoolean(false)
    stops[fileName] = stop
    promise.resolve(null)

    io.execute {
      try {
        if (wifiOnly && !isUnmetered()) throw DownloadProblem("needs_wifi")
        val needed = total - part.length()
        if (StatFs(dir.absolutePath).availableBytes < needed + SPARE_BYTES) throw DownloadProblem("no_space")
        var attempts = 0
        while (part.length() < total) {
          try {
            fetch(url, part, status, stop, wifiOnly)
          } catch (e: IOException) {
            // Flaky mobile networks: try again a few times from where it stopped.
            if (stop.get() || ++attempts >= 4) throw e
            Thread.sleep(2000L * attempts)
          }
          if (stop.get()) {
            status.state = "paused"
            return@execute
          }
        }
        status.state = "verifying"
        if (!sha256(part).equals(sha256, ignoreCase = true)) {
          part.delete()
          throw DownloadProblem("corrupt")
        }
        if (!part.renameTo(target)) throw DownloadProblem("failed")
        status.bytes = target.length()
        status.state = "done"
      } catch (e: DownloadProblem) {
        status.state = "failed"
        status.error = e.code
      } catch (e: IOException) {
        status.state = if (stop.get()) "paused" else "failed"
        status.error = if (stop.get()) null else "network"
      } catch (e: Exception) {
        status.state = "failed"
        status.error = "failed"
      } finally {
        stops.remove(fileName)
      }
    }
  }

  private class DownloadProblem(val code: String) : Exception(code)

  /** One connection's worth of downloading, appending to [part]. */
  private fun fetch(url: String, part: File, status: Status, stop: AtomicBoolean, wifiOnly: Boolean) {
    val have = part.length()
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = 30_000
      readTimeout = 60_000
      instanceFollowRedirects = true
      if (have > 0) setRequestProperty("Range", "bytes=$have-")
    }
    try {
      val code = connection.responseCode
      val append =
          when (code) {
            206 -> true
            200 -> false // the server ignored Range: start over
            416 -> return // nothing left to fetch
            else -> throw DownloadProblem("network")
          }
      if (!append) status.bytes = 0
      FileOutputStream(part, append).use { out ->
        connection.inputStream.use { input ->
          val buffer = ByteArray(256 * 1024)
          var sinceCheck = 0L
          while (true) {
            if (stop.get()) return
            val n = input.read(buffer)
            if (n < 0) break
            out.write(buffer, 0, n)
            status.bytes += n
            sinceCheck += n
            if (wifiOnly && sinceCheck > 16 * MB) {
              sinceCheck = 0
              if (!isUnmetered()) throw DownloadProblem("needs_wifi")
            }
          }
        }
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(1024 * 1024)
      while (true) {
        val n = input.read(buffer)
        if (n < 0) break
        digest.update(buffer, 0, n)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  override fun downloadStatus(fileName: String, promise: Promise) {
    val status = statuses[fileName]
    val json =
        if (status != null) {
          JSONObject().put("state", status.state).put("bytes", status.bytes).put("total", status.total).put("error", status.error ?: JSONObject.NULL)
        } else {
          val target = File(dir, safe(fileName))
          val part = File(dir, safe(fileName) + ".part")
          when {
            target.isFile -> JSONObject().put("state", "done").put("bytes", target.length()).put("total", target.length())
            part.isFile -> JSONObject().put("state", "paused").put("bytes", part.length()).put("total", 0)
            else -> JSONObject().put("state", "idle").put("bytes", 0).put("total", 0)
          }
        }
    promise.resolve(json.toString())
  }

  override fun pauseDownload(fileName: String, promise: Promise) {
    stops[fileName]?.set(true)
    promise.resolve(null)
  }

  override fun modelPath(fileName: String, promise: Promise) {
    val target = File(dir, safe(fileName))
    promise.resolve(if (target.isFile) target.absolutePath else "")
  }

  override fun deleteModels(promise: Promise) {
    stops.values.forEach { it.set(true) }
    io.execute {
      // Give running downloads a moment to notice and close their files.
      Thread.sleep(500)
      dir.deleteRecursively()
      statuses.clear()
      promise.resolve(null)
    }
  }

  override fun keepScreenOn(on: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    activity?.runOnUiThread {
      if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
    promise.resolve(null)
  }

  override fun invalidate() {
    stops.values.forEach { it.set(true) }
    io.shutdown()
    super.invalidate()
  }

  private fun safe(name: String) = name.replace(Regex("[^A-Za-z0-9._-]"), "_")

  companion object {
    const val NAME = "KonModel"
    private const val MB = 1024L * 1024L
    /** Room left over after a download, so the phone isn't filled to the brim. */
    private const val SPARE_BYTES = 300L * MB
  }
}
