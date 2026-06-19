import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CounterCard } from '../../shared/components/counter-card/counter-card';
import { Loading } from '../../shared/components/loading/loading';
import { DetectionService } from '../../core/services/detection';
import { DetectionBox } from '../../core/models/detection-result.model';

@Component({
  selector: 'app-live-counter',
  imports: [CounterCard, Loading],
  templateUrl: './live-counter.html',
  styleUrl: './live-counter.scss',
})
export class LiveCounter implements OnDestroy {
  private readonly detection = inject(DetectionService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly videoRef =
    viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('overlay');

  readonly peopleCount = signal(0);
  readonly isCameraActive = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private rafId = 0;

  async startCamera(): Promise<void> {
    if (this.isCameraActive() || this.isLoading()) {
      return;
    }
    this.errorMessage.set(null);
    this.isLoading.set(true);

    try {
      // Carrega o modelo YOLO e abre a webcam em paralelo.
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
        this.detection.loadModel(),
      ]);

      this.stream = stream;
      const video = this.videoRef()?.nativeElement;
      if (!video) {
        return;
      }
      video.srcObject = stream;
      await video.play();

      this.isCameraActive.set(true);
      this.loop();
    } catch (err) {
      this.errorMessage.set(
        'Não foi possível iniciar a câmera ou carregar o modelo.',
      );
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  stopCamera(): void {
    this.isCameraActive.set(false);
    cancelAnimationFrame(this.rafId);

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
    this.clearOverlay();
    this.peopleCount.set(0);
  }

  /** Captura o frame atual, roda a inferência e atualiza a contagem. */
  private async captureFrame(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video || video.readyState < 2) {
      return;
    }
    // TODO: executar inferência -> feito pelo DetectionService
    const result = await this.detection.detectFrame(video);

    // A câmera pode ter sido parada enquanto a inferência rodava.
    if (!this.isCameraActive()) {
      return;
    }
    this.peopleCount.set(result.peopleCount);
    this.drawBoxes(result.boxes ?? [], video.videoWidth, video.videoHeight);

    // App zoneless: a inferência resolve fora de um ciclo de CD, então
    // forçamos a atualização do contador na tela após cada frame.
    this.cdr.detectChanges();
  }

  /** Loop contínuo enquanto a câmera estiver ativa. */
  private async loop(): Promise<void> {
    if (!this.isCameraActive()) {
      return;
    }
    await this.captureFrame();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private drawBoxes(boxes: DetectionBox[], srcW: number, srcH: number): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, srcW, srcH);
    ctx.lineWidth = Math.max(2, srcW / 320);
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.font = `${Math.max(14, srcW / 40)}px system-ui, sans-serif`;

    for (const box of boxes) {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      const label = `${Math.round(box.score * 100)}%`;
      ctx.fillText(label, box.x, Math.max(box.y - 4, 12));
    }
  }

  private clearOverlay(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
