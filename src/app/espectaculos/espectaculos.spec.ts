import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EspectaculosComponent } from './espectaculos';

describe('Espectaculos', () => {
  let component: EspectaculosComponent;
  let fixture: ComponentFixture<EspectaculosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EspectaculosComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EspectaculosComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
