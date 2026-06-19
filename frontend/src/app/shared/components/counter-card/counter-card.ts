import { Component, input } from '@angular/core';

@Component({
  selector: 'app-counter-card',
  imports: [],
  templateUrl: './counter-card.html',
  styleUrl: './counter-card.scss',
})
export class CounterCard {
  readonly title = input('Pessoas Detectadas');
  readonly count = input(0);
  readonly caption = input('Aguardando processamento');
}
