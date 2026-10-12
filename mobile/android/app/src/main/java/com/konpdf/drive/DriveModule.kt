package com.konpdf.drive

import android.accounts.Account
import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.auth.api.identity.AuthorizationClient
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import com.konpdf.specs.NativeDriveSpec
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Optional Google Drive backup (src/native/NativeDrive.ts).
 *
 * Access comes from Google's AuthorizationClient (Play services) with one
 * scope, drive.file: KonPDF can see and change only the files it puts in
 * Drive itself, never the rest of someone's Drive. No client ID or secret
 * ships in the app: Google recognises KonPDF by its package name and signing
 * certificate, registered once as an Android OAuth client
 * (docs/google-drive-setup.md).
 *
 * Uploads stream from the app's cache straight to Drive (a resumable upload,
 * sent in one go), so even a 50 MB file needs no extra memory. The converter
 * never sees them.
 */
class DriveModule(reactContext: ReactApplicationContext) :
    NativeDriveSpec(reactContext), ActivityEventListener {

  /** The authorize() call waiting for Google's screens to close. */
  private var pendingAuth: Promise? = null
  private val io = Executors.newCachedThreadPool()

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = NAME

  override fun isAvailable(promise: Promise) {
    val status = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(reactApplicationContext)
    promise.resolve(status == ConnectionResult.SUCCESS)
  }

  // ---------------------------------------------------------------- access

  override fun authorize(email: String, interactive: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (interactive) {
      if (activity == null) {
        promise.reject(ERROR_FAILED, "KonPDF isn't in the foreground")
        return
      }
      if (pendingAuth != null) {
        promise.reject(ERROR_BUSY, "Already asking for Drive access")
        return
      }
      pendingAuth = promise
    }
    val request =
        AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(DRIVE_FILE)))
            .apply {
              if (email.isNotBlank()) setAccount(Account(email, ACCOUNT_TYPE))
              // Connecting: always let the person choose which Google account.
              else if (interactive) setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
            }
            .build()
    try {
      client()
          .authorize(request)
          .addOnSuccessListener { result ->
            when {
              !result.hasResolution() -> settle(promise) { it.resolve(result.accessToken ?: "") }
              activity == null || !interactive ->
                  promise.reject(ERROR_SIGNED_OUT, "Google needs to ask for Drive access again")
              else -> launch(activity, result, promise)
            }
          }
          .addOnFailureListener { e -> settle(promise) { fail(it, e) } }
    } catch (e: Throwable) {
      settle(promise) { fail(it, e) }
    }
  }

  /** Google's account picker and permission screen. */
  private fun launch(activity: Activity, result: AuthorizationResult, promise: Promise) {
    val intent = result.pendingIntent
    if (intent == null) {
      settle(promise) { it.reject(ERROR_FAILED, "Google sent no permission screen") }
      return
    }
    try {
      activity.startIntentSenderForResult(intent.intentSender, REQUEST_AUTH, null, 0, 0, 0)
    } catch (e: Throwable) {
      settle(promise) { fail(it, e) }
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_AUTH) return
    val promise = pendingAuth ?: return
    pendingAuth = null
    if (data == null) {
      Log.i(TAG, "Permission screen closed (result $resultCode)")
      promise.resolve("")
      return
    }
    try {
      val result = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data)
      promise.resolve(result.accessToken ?: "")
    } catch (e: ApiException) {
      if (e.statusCode == CommonStatusCodes.CANCELED || e.statusCode == SIGN_IN_CANCELLED) {
        promise.resolve("")
      } else {
        fail(promise, e)
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun clearToken(token: String, promise: Promise) {
    try {
      client()
          .clearToken(ClearTokenRequest.builder().setToken(token).build())
          .addOnCompleteListener { promise.resolve(null) }
    } catch (e: Throwable) {
      // Nothing to clear is fine: the next authorize() asks Google afresh.
      promise.resolve(null)
    }
  }

  override fun revoke(email: String, promise: Promise) {
    try {
      val request =
          RevokeAccessRequest.builder()
              .setAccount(Account(email, ACCOUNT_TYPE))
              .setScopes(listOf(Scope(DRIVE_FILE)))
              .build()
      client()
          .revokeAccess(request)
          .addOnSuccessListener { promise.resolve(null) }
          .addOnFailureListener { e -> fail(promise, e) }
    } catch (e: Throwable) {
      fail(promise, e)
    }
  }

  // --------------------------------------------------------------- uploads

  override fun upload(token: String, path: String, mime: String, metadataJson: String, promise: Promise) {
    io.execute {
      val file = File(path)
      if (!file.isFile) {
        promise.reject(ERROR_MISSING, "That file is no longer on this phone")
        return@execute
      }
      val connections = mutableListOf<HttpURLConnection>()
      try {
        // 1. Tell Drive what is coming; it answers with an upload address.
        val start = open("$UPLOAD_URL?uploadType=resumable&fields=$FIELDS", "POST", connections)
        start.setRequestProperty("Authorization", "Bearer $token")
        start.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
        start.setRequestProperty("X-Upload-Content-Type", mime)
        start.setRequestProperty("X-Upload-Content-Length", file.length().toString())
        start.outputStream.use { it.write(metadataJson.toByteArray(Charsets.UTF_8)) }
        if (start.responseCode !in 200..299) {
          rejectHttp(start, promise)
          return@execute
        }
        val session = start.getHeaderField("Location") ?: throw IOException("Drive sent no upload address")

        // 2. Send the file itself, streamed from disk.
        val send = open(session, "PUT", connections)
        send.setRequestProperty("Content-Type", mime)
        send.setFixedLengthStreamingMode(file.length())
        file.inputStream().use { input -> send.outputStream.use { input.copyTo(it) } }
        if (send.responseCode !in 200..299) {
          rejectHttp(send, promise)
          return@execute
        }
        promise.resolve(send.inputStream.bufferedReader().use { it.readText() })
      } catch (e: IOException) {
        Log.w(TAG, "Upload interrupted", e)
        promise.reject(ERROR_NETWORK, e.message ?: "The connection dropped", e)
      } catch (e: Throwable) {
        Log.e(TAG, "Upload failed", e)
        promise.reject(ERROR_FAILED, e.message ?: "Upload failed", e)
      } finally {
        connections.forEach { it.disconnect() }
      }
    }
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdown()
    super.invalidate()
  }

  // ---------------------------------------------------------------- helpers

  private fun client(): AuthorizationClient =
      reactApplicationContext.currentActivity?.let { Identity.getAuthorizationClient(it) }
          ?: Identity.getAuthorizationClient(reactApplicationContext)

  /** Settles [promise], freeing the "Google's screens are open" slot if it holds it. */
  private fun settle(promise: Promise, block: (Promise) -> Unit) {
    if (pendingAuth === promise) pendingAuth = null
    block(promise)
  }

  private fun fail(promise: Promise, e: Throwable) {
    val status = (e as? ApiException)?.statusCode
    // Status 10 almost always means this build's package name and signing
    // certificate aren't registered as an Android OAuth client yet.
    Log.e(TAG, "Drive access failed (status $status)", e)
    val code =
        when (status) {
          CommonStatusCodes.DEVELOPER_ERROR -> ERROR_NOT_CONFIGURED
          CommonStatusCodes.NETWORK_ERROR,
          CommonStatusCodes.TIMEOUT -> ERROR_NETWORK
          CommonStatusCodes.SIGN_IN_REQUIRED,
          CommonStatusCodes.INVALID_ACCOUNT -> ERROR_SIGNED_OUT
          CommonStatusCodes.API_NOT_CONNECTED,
          CommonStatusCodes.SERVICE_VERSION_UPDATE_REQUIRED,
          CommonStatusCodes.SERVICE_DISABLED -> ERROR_UNAVAILABLE
          else -> ERROR_FAILED
        }
    promise.reject(code, e.message ?: "Drive access failed", e)
  }

  private fun open(url: String, method: String, opened: MutableList<HttpURLConnection>): HttpURLConnection =
      (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = method
        doOutput = true
        connectTimeout = 30_000
        readTimeout = 120_000
        opened += this
      }

  /** Drive said no: hand JavaScript the status and Drive's reason. */
  private fun rejectHttp(connection: HttpURLConnection, promise: Promise) {
    val status = connection.responseCode
    val body = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
    Log.w(TAG, "Drive answered $status: ${body.take(300)}")
    promise.reject("drive_http_$status", body)
  }

  companion object {
    const val NAME = "KonDrive"
    private const val TAG = "KonDrive"
    private const val REQUEST_AUTH = 5140
    private const val DRIVE_FILE = "https://www.googleapis.com/auth/drive.file"
    private const val ACCOUNT_TYPE = "com.google"
    /** GoogleSignInStatusCodes.SIGN_IN_CANCELLED: the person backed out. */
    private const val SIGN_IN_CANCELLED = 12501
    private const val UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
    private const val FIELDS = "id,webViewLink"
    private const val ERROR_FAILED = "drive_failed"
    private const val ERROR_BUSY = "busy"
    private const val ERROR_MISSING = "missing"
    private const val ERROR_NETWORK = "drive_network"
    private const val ERROR_SIGNED_OUT = "drive_signed_out"
    private const val ERROR_UNAVAILABLE = "drive_unavailable"
    private const val ERROR_NOT_CONFIGURED = "drive_not_configured"
  }
}
