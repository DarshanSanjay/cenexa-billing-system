export type BarcodeFormat = 'aztec' | 'code_128' | 'code_39' | 'code_93' | 'codabar' | 'data_matrix' | 'ean_13' | 'ean_8' | 'itf' | 'pdf417' | 'qr_code' | 'upc_a' | 'upc_e'

export type ScannerResult = {
  rawValue: string
  format: BarcodeFormat | string
}

export type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string; format?: string }>>
}

const RETAIL_FORMATS: BarcodeFormat[] = ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_39', 'itf']

export function normalizeBarcode(rawValue: string, format?: string): ScannerResult | null {
  const value = rawValue.trim()
  if (!value) return null
  const normalizedFormat = (format || '').toLowerCase().replace(/-/g, '_')

  if (/^\d{13}$/.test(value)) return { rawValue: value, format: normalizedFormat || 'ean_13' }
  if (/^\d{12}$/.test(value)) return { rawValue: value, format: normalizedFormat || 'upc_a' }
  if (/^\d{8}$/.test(value)) return { rawValue: value, format: normalizedFormat || 'ean_8' }
  if (/^[\x20-\x7E]+$/.test(value)) return { rawValue: value, format: normalizedFormat || 'code_128' }
  return null
}

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export function getCameraErrorMessage(error: unknown): string {
  const name = (error as DOMException | undefined)?.name || ''
  switch (name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow camera access in browser settings or use manual barcode entry.'
    case 'NotFoundError':
      return 'No camera was found on this device. Use manual barcode entry instead.'
    case 'NotReadableError':
      return 'The camera is busy or unavailable. Close other camera apps and try again.'
    case 'SecurityError':
      return 'Camera access is blocked by the page security policy. Use HTTPS and try again.'
    default:
      return 'Unable to start the camera. You can still enter a barcode manually.'
  }
}

export class BrowserBarcodeScanner {
  private stream: MediaStream | null = null
  private rafId: number | null = null
  private video: HTMLVideoElement | null = null
  private detector: BarcodeDetectorLike | null = null
  private running = false
  private lastDecode = 0
  private lastValue = ''
  private readonly formats: BarcodeFormat[]

  constructor(formats: BarcodeFormat[] = RETAIL_FORMATS) {
    this.formats = formats
  }

  async start(video: HTMLVideoElement, onResult: (result: ScannerResult) => void, onError: (error: Error) => void): Promise<void> {
    this.stop()
    if (!navigator.mediaDevices?.getUserMedia) {
      onError(new Error('Camera API is not available in this browser.'))
      return
    }

    try {
      const Detector = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike }).BarcodeDetector
      if (!Detector) throw new Error('This browser does not expose BarcodeDetector.')

      const supported = await this.getSupportedFormats(Detector)
      const selected = this.formats.filter((format) => supported.length === 0 || supported.includes(format))
      this.detector = new Detector({ formats: selected as string[] })
      this.video = video
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 24 } },
        audio: false,
      })
      video.srcObject = this.stream
      video.setAttribute('playsinline', 'true')
      video.muted = true
      await video.play()
      this.running = true
      this.loop(onResult, onError)
    } catch (error) {
      this.stop()
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.video) this.video.srcObject = null
    this.video = null
    this.detector = null
  }

  private async getSupportedFormats(Detector: new (options?: { formats?: string[] }) => BarcodeDetectorLike): Promise<string[]> {
    const detectorCtor = Detector as unknown as { getSupportedFormats?: () => Promise<string[]> }
    return detectorCtor.getSupportedFormats ? detectorCtor.getSupportedFormats() : []
  }

  private loop(onResult: (result: ScannerResult) => void, onError: (error: Error) => void): void {
    if (!this.running || !this.detector || !this.video) return
    const now = performance.now()
    // Decode at roughly 8-10 FPS to reduce CPU/battery use while keeping the UI responsive.
    if (now - this.lastDecode >= 120) {
      this.lastDecode = now
      this.detector.detect(this.video)
        .then((items) => {
          for (const item of items) {
            const result = normalizeBarcode(item.rawValue || '', item.format)
            if (result && result.rawValue !== this.lastValue) {
              this.lastValue = result.rawValue
              onResult(result)
              break
            }
          }
        })
        .catch((error) => {
          // Detection errors are transient; keep scanning unless the stream itself failed.
          if (this.running && error) onError(error instanceof Error ? error : new Error(String(error)))
        })
    }
    this.rafId = requestAnimationFrame(() => this.loop(onResult, onError))
  }
}

export function validateRetailBarcode(value: string, format?: string): boolean {
  const result = normalizeBarcode(value, format)
  if (!result) return false
  if (result.format === 'ean_13' && /^\d{13}$/.test(result.rawValue)) return checkDigit(result.rawValue, 13)
  if (result.format === 'upc_a' && /^\d{12}$/.test(result.rawValue)) return checkDigit(result.rawValue, 12)
  if (result.format === 'ean_8' && /^\d{8}$/.test(result.rawValue)) return checkDigit(result.rawValue, 8)
  return true
}

function checkDigit(value: string, length: number): boolean {
  if (value.length !== length || !/^\d+$/.test(value)) return false
  const digits = value.split('').map(Number)
  const check = digits.pop() as number
  const sum = digits.reduce((total, digit, index) => {
    const fromRight = digits.length - index
    return total + digit * (fromRight % 2 === 0 ? 3 : 1)
  }, 0)
  return (10 - (sum % 10)) % 10 === check
}

export function playScanFeedback(): void {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.11)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    setTimeout(() => ctx.close().catch(() => undefined), 250)
  } catch {
    // Sound feedback is optional; visual feedback remains available.
  }
}

export function resetLastValue(scanner: BrowserBarcodeScanner): void {
  // restarting the scanner naturally resets internal state
  scanner.stop()
}
