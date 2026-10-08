package com.konpdf.scan

import java.io.File
import java.io.FileOutputStream

/**
 * Writes a PDF whose pages are JPEG pictures, stored as JPEG inside the PDF.
 *
 * Android's own PdfDocument re-compresses pictures losslessly, which makes a
 * scanned page several megabytes; keeping the JPEG makes it a few hundred KB.
 * Each page is A4 wide (595 pt) with the picture's proportions.
 */
object JpegPdf {

  class Page(val jpeg: ByteArray, val width: Int, val height: Int)

  fun write(pages: List<Page>, target: File) {
    FileOutputStream(target).buffered().use { out ->
      var written = 0L
      val offsets = mutableListOf<Long>()
      fun raw(bytes: ByteArray) {
        out.write(bytes)
        written += bytes.size
      }
      fun text(s: String) = raw(s.toByteArray(Charsets.ISO_8859_1))
      fun obj(body: () -> Unit) {
        offsets.add(written)
        text("${offsets.size} 0 obj\n")
        body()
        text("\nendobj\n")
      }

      text("%PDF-1.4\n%âãÏÓ\n")
      // 1: catalog, 2: page tree, then per page: page, image, contents.
      val kids = pages.indices.joinToString(" ") { "${3 + it * 3} 0 R" }
      obj { text("<< /Type /Catalog /Pages 2 0 R >>") }
      obj { text("<< /Type /Pages /Kids [$kids] /Count ${pages.size} >>") }
      pages.forEachIndexed { i, page ->
        val pageId = 3 + i * 3
        val w = 595.0
        val h = 595.0 * page.height / page.width
        val box = "0 0 ${fmt(w)} ${fmt(h)}"
        obj {
          text(
              "<< /Type /Page /Parent 2 0 R /MediaBox [$box] " +
                  "/Resources << /XObject << /Im0 ${pageId + 1} 0 R >> >> /Contents ${pageId + 2} 0 R >>")
        }
        obj {
          text(
              "<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} " +
                  "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.size} >>\nstream\n")
          raw(page.jpeg)
          text("\nendstream")
        }
        val draw = "q ${fmt(w)} 0 0 ${fmt(h)} 0 0 cm /Im0 Do Q"
        obj { text("<< /Length ${draw.length} >>\nstream\n$draw\nendstream") }
      }
      val xref = written
      text("xref\n0 ${offsets.size + 1}\n0000000000 65535 f \n")
      offsets.forEach { text(String.format(java.util.Locale.US, "%010d 00000 n \n", it)) }
      text("trailer\n<< /Size ${offsets.size + 1} /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n")
    }
  }

  private fun fmt(v: Double) = String.format(java.util.Locale.US, "%.2f", v)
}
