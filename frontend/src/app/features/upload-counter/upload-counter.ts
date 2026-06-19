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
  selector: 'app-upload-counter',
  imports: [CounterCard, Loading],
  templateUrl: './upload-counter.html',
  styleUrl: './upload-counter.scss',
})
export class UploadCounter implements OnDestroy {
  private readonly detection = inject(DetectionService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('overlay');

  readonly peopleCount = signal(0);
  readonly previewUrl = signal<string | null>(null);
  readonly fileType = signal<'image' | 'video' | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly isLoading = signal(false);

  private rafId = 0;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFile(input.files?.[0] ?? null);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.handleFile(event.dataTransfer?.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  private handleFile(file: File | null): void {
    if (!file) {
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      return;
    }

    this.cancelLoop();
    this.revokePreview();
    this.clearOverlay();
    this.peopleCount.set(0);

    this.previewUrl.set(URL.createObjectURL(file));
    this.fileType.set(isImage ? 'image' : 'video');
    this.fileName.set(file.name);
  }

  /** Detecta pessoas na imagem assim que ela termina de carregar. */
  async onImageLoaded(event: Event): Promise<void> {
    const image = event.target as HTMLImageElement;
    this.isLoading.set(true);
    try {
      // TODO: converter imagem para tensor / enviar frame para YOLO
      //       -> ambos os passos são feitos pelo DetectionService.
      const result = await this.detection.detectImage(image);
      this.peopleCount.set(result.peopleCount);
      this.drawBoxes(
        result.boxes ?? [],
        image.naturalWidth,
        image.naturalHeight,
      );
    } finally {
      this.isLoading.set(false);
      // App zoneless: a inferência resolve fora de um ciclo de CD.
      this.cdr.detectChanges();
    }
  }

  /** Inicia a detecção contínua nos frames do vídeo enquanto reproduz. */
  async onVideoPlay(event: Event): Promise<void> {
    const video = event.target as HTMLVideoElement;
    await this.detection.loadModel();
    this.videoLoop(video);
  }

  onVideoPause(): void {
    this.cancelLoop();
  }

  private async videoLoop(video: HTMLVideoElement): Promise<void> {
    if (video.paused || video.ended) {
      return;
    }
    this.isLoading.set(false);
    const result = await this.detection.detectFrame(video);
    this.peopleCount.set(result.peopleCount);
    this.drawBoxes(result.boxes ?? [], video.videoWidth, video.videoHeight);
    this.cdr.detectChanges();
    this.rafId = requestAnimationFrame(() => this.videoLoop(video));
  }

  private drawBoxes(boxes: DetectionBox[], srcW: number, srcH: number): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !srcW || !srcH) {
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
      ctx.fillText(
        `${Math.round(box.score * 100)}%`,
        box.x,
        Math.max(box.y - 4, 12),
      );
    }
  }

  private clearOverlay(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private cancelLoop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  ngOnDestroy(): void {
    this.cancelLoop();
    this.revokePreview();
  }
}
