package com.konpdf.files

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID

/**
 * KonPDF's own files in the cache folder, shared by the native modules:
 * cache/<kind>/<uuid>/<name>, described to JavaScript as a LocalFile.
 */
object CacheFiles {

  fun newFile(context: Context, kind: String, name: String): File {
    val safe = name.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").take(150).ifBlank { "file" }
    val dir = File(File(context.cacheDir, kind), UUID.randomUUID().toString())
    dir.mkdirs()
    return File(dir, safe)
  }

  fun describe(file: File, name: String = file.name, mime: String): JSONObject =
      JSONObject()
          .put("uri", Uri.fromFile(file).toString())
          .put("path", file.absolutePath)
          .put("name", name)
          .put("mime", mime)
          .put("size", file.length())

  /**
   * Decodes an image upright (the camera's rotation flag applied) with its
   * long side at most [maxSide], using little memory for big photos.
   * Null if Android can't read the file.
   */
  fun decodeUpright(path: String, maxSide: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
    val decoded =
        BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null

    val matrix = Matrix()
    val longSide = maxOf(decoded.width, decoded.height)
    if (longSide > maxSide) {
      val scale = maxSide.toFloat() / longSide
      matrix.postScale(scale, scale)
    }
    val orientation =
        runCatching { ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
            .getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> matrix.apply { postRotate(90f); postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_TRANSVERSE -> matrix.apply { postRotate(270f); postScale(-1f, 1f) }
    }
    if (matrix.isIdentity) return decoded
    val result = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    if (result !== decoded) decoded.recycle()
    return result
  }

  /** JPEG bytes of [bitmap] on white (transparent PNGs would turn black). */
  fun jpeg(bitmap: Bitmap, quality: Int): ByteArray {
    val opaque =
        if (bitmap.hasAlpha()) {
          Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888).also {
            val canvas = android.graphics.Canvas(it)
            canvas.drawColor(android.graphics.Color.WHITE)
            canvas.drawBitmap(bitmap, 0f, 0f, null)
          }
        } else bitmap
    val out = ByteArrayOutputStream()
    opaque.compress(Bitmap.CompressFormat.JPEG, quality, out)
    if (opaque !== bitmap) opaque.recycle()
    return out.toByteArray()
  }
}
