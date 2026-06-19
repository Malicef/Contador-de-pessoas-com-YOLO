import { Injectable } from '@angular/core';
import * as ort from 'onnxruntime-web';
import {
  DetectionBox,
  DetectionResult,
} from '../models/detection-result.model';

/** Fonte de imagem que pode ser desenhada em um canvas. */
type ImageSource =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | ImageBitmap;

const MODEL_URL = 'assets/modelo/yolov8m.onnx';
const INPUT_SIZE = 640; // YOLOv8 trabalha com entradas 640x640
const PERSON_CLASS_ID = 0; // classe "person" no dataset COCO
const CONFIDENCE_THRESHOLD = 0.5;
const IOU_THRESHOLD = 0.45;

@Injectable({
  providedIn: 'root',
})
export class DetectionService {
  private session: ort.InferenceSession | null = null;
  private loadingPromise: Promise<void> | null = null;

  // Canvas reutilizado para o pré-processamento (letterbox 640x640).
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d', {
    willReadFrequently: true,
  })!;

  constructor() {
    // Carrega os binários WebAssembly do ONNX Runtime a partir de /ort
    // (copiados em build via angular.json) e usa uma única thread para
    // dispensar os headers de cross-origin isolation no dev server.
    ort.env.wasm.wasmPaths = new URL('/ort/', document.baseURI).href;
    ort.env.wasm.numThreads = 1;
  }

  /** Carrega o modelo YOLO (ONNX Runtime Web). Idempotente. */
  async loadModel(): Promise<void> {
    if (this.session) {
      return;
    }
    if (!this.loadingPromise) {
      this.loadingPromise = ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      }).then((session) => {
        this.session = session;
      });
    }
    await this.loadingPromise;
  }

  /** Detecta pessoas em uma imagem. */
  async detectImage(image: ImageSource): Promise<DetectionResult> {
    return this.detect(image);
  }

  /** Detecta pessoas em um vídeo (frame atual do elemento). */
  async detectVideo(video: HTMLVideoElement): Promise<DetectionResult> {
    return this.detect(video);
  }

  /** Detecta pessoas em um único frame (ex.: webcam ao vivo). */
  async detectFrame(frame: ImageSource): Promise<DetectionResult> {
    return this.detect(frame);
  }

  /** Pipeline completo: pré-processa, executa a inferência e pós-processa. */
  private async detect(source: ImageSource): Promise<DetectionResult> {
    await this.loadModel();
    const session = this.session!;

    const { width, height } = this.getSourceSize(source);
    if (!width || !height) {
      return this.emptyResult();
    }

    const { tensor, scale, padX, padY } = this.preprocess(source, width, height);

    const feeds: Record<string, ort.Tensor> = {
      [session.inputNames[0]]: tensor,
    };
    const output = await session.run(feeds);
    const result = output[session.outputNames[0]];

    const boxes = this.postprocess(
      result.data as Float32Array,
      result.dims,
      scale,
      padX,
      padY,
      width,
      height,
    );

    const confidence = boxes.reduce((max, b) => Math.max(max, b.score), 0);
    return {
      peopleCount: boxes.length,
      confidence,
      timestamp: new Date().toISOString(),
      boxes,
    };
  }

  /**
   * Desenha a fonte em um canvas 640x640 com letterbox (mantém proporção),
   * normaliza para [0,1] e organiza no formato NCHW (RGB) exigido pelo modelo.
   */
  private preprocess(source: ImageSource, srcW: number, srcH: number) {
    const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
    const drawW = Math.round(srcW * scale);
    const drawH = Math.round(srcH * scale);
    const padX = Math.floor((INPUT_SIZE - drawW) / 2);
    const padY = Math.floor((INPUT_SIZE - drawH) / 2);

    this.canvas.width = INPUT_SIZE;
    this.canvas.height = INPUT_SIZE;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    this.ctx.drawImage(source as CanvasImageSource, padX, padY, drawW, drawH);

    const { data } = this.ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const area = INPUT_SIZE * INPUT_SIZE;
    const float = new Float32Array(area * 3);

    // NCHW: canal R inteiro, depois G, depois B.
    for (let i = 0; i < area; i++) {
      const j = i * 4;
      float[i] = data[j] / 255; // R
      float[i + area] = data[j + 1] / 255; // G
      float[i + area * 2] = data[j + 2] / 255; // B
    }

    const tensor = new ort.Tensor('float32', float, [
      1,
      3,
      INPUT_SIZE,
      INPUT_SIZE,
    ]);
    return { tensor, scale, padX, padY };
  }

  /**
   * Decodifica a saída do YOLOv8 (dims [1, 84, 8400]), filtra apenas a classe
   * "person", aplica o limiar de confiança, remove o letterbox e roda NMS.
   */
  private postprocess(
    data: Float32Array,
    dims: readonly number[],
    scale: number,
    padX: number,
    padY: number,
    srcW: number,
    srcH: number,
  ): DetectionBox[] {
    const numChannels = dims[1]; // 84 = 4 (bbox) + 80 (classes)
    const numAnchors = dims[2]; // 8400
    const candidates: DetectionBox[] = [];

    for (let a = 0; a < numAnchors; a++) {
      // Score apenas da classe "person".
      const score = data[(4 + PERSON_CLASS_ID) * numAnchors + a];
      if (score < CONFIDENCE_THRESHOLD) {
        continue;
      }

      // Box no espaço 640x640 (centro x,y + largura,altura).
      const cx = data[0 * numAnchors + a];
      const cy = data[1 * numAnchors + a];
      const w = data[2 * numAnchors + a];
      const h = data[3 * numAnchors + a];

      // Desfaz o letterbox -> coordenadas na imagem original.
      const x = (cx - w / 2 - padX) / scale;
      const y = (cy - h / 2 - padY) / scale;
      const width = w / scale;
      const height = h / scale;

      candidates.push({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, srcW - x),
        height: Math.min(height, srcH - y),
        score,
      });
    }

    return this.nms(candidates);
  }

  /** Non-Maximum Suppression para remover caixas sobrepostas. */
  private nms(boxes: DetectionBox[]): DetectionBox[] {
    const sorted = [...boxes].sort((a, b) => b.score - a.score);
    const kept: DetectionBox[] = [];

    for (const box of sorted) {
      const overlaps = kept.some((k) => this.iou(box, k) > IOU_THRESHOLD);
      if (!overlaps) {
        kept.push(box);
      }
    }
    return kept;
  }

  /** Intersection over Union entre duas caixas. */
  private iou(a: DetectionBox, b: DetectionBox): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);

    const interW = Math.max(0, x2 - x1);
    const interH = Math.max(0, y2 - y1);
    const inter = interW * interH;
    const union = a.width * a.height + b.width * b.height - inter;
    return union <= 0 ? 0 : inter / union;
  }

  private getSourceSize(source: ImageSource): { width: number; height: number } {
    if (source instanceof HTMLVideoElement) {
      return { width: source.videoWidth, height: source.videoHeight };
    }
    if (source instanceof HTMLImageElement) {
      return { width: source.naturalWidth, height: source.naturalHeight };
    }
    return { width: source.width, height: source.height };
  }

  private emptyResult(): DetectionResult {
    return {
      peopleCount: 0,
      confidence: 0,
      timestamp: new Date().toISOString(),
      boxes: [],
    };
  }
}
