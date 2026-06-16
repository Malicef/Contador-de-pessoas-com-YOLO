import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveCounter } from './live-counter';

describe('LiveCounter', () => {
  let component: LiveCounter;
  let fixture: ComponentFixture<LiveCounter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveCounter],
    }).compileComponents();

    fixture = TestBed.createComponent(LiveCounter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
