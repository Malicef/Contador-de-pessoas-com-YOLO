import { Component } from '@angular/core';

export interface DetectionHistory {
  timestamp: string;
  source: 'camera' | 'image' | 'video';
  count: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly totalDetected = 0;
  readonly lastAnalysis = 'Nenhuma análise realizada';

  history: DetectionHistory[] = [];
}
