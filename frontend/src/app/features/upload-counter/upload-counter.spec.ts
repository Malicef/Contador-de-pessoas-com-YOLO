import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadCounter } from './upload-counter';

describe('UploadCounter', () => {
  let component: UploadCounter;
  let fixture: ComponentFixture<UploadCounter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadCounter],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadCounter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
