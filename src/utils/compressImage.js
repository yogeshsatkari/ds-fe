/**
 * In-browser document image optimizer using HTML5 Canvas.
 * Scales down large resolutions to 2000px max side (2K standard document scan resolution)
 * and applies 85% JPEG compression, reducing 4-8 MB photos to ~250-400 KB
 * while keeping all small text, tables, decimal values, and doctor handwriting crisp for OCR.
 */
export async function compressImage(file, { maxDimension = 2000, quality = 0.85 } = {}) {
  // Only process image files; leave PDFs and unknown types untouched
  if (!file.type?.startsWith('image/')) {
    return file
  }

  // If already under 300 KB and JPEG, no compression needed
  if (file.size < 300 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Scale down proportionally if dimensions exceed maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Fill white background (handles transparent PNGs)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }

          // If for any reason compressed blob is larger than original, keep original
          if (blob.size >= file.size) {
            resolve(file)
            return
          }

          const originalName = file.name.replace(/\.[^/.]+$/, '')
          const optimizedFile = new File([blob], `${originalName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })

          resolve(optimizedFile)
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Fallback to original file on error
      resolve(file)
    }

    img.src = objectUrl
  })
}
