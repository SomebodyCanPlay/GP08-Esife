import { ComponentFixture, TestBed } from '@angular/core/testing';

// 1. Aquí importamos el nombre CORRECTO de la clase
import { CompraComponent } from './compra';

describe('CompraComponent', () => {
  // 2. Usamos el tipo CompraComponent
  let component: CompraComponent;
  let fixture: ComponentFixture<CompraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // 3. Lo metemos en los imports con su nombre real
      imports: [CompraComponent]
    })
    .compileComponents();

    // 4. Lo creamos usando el nombre correcto
    fixture = TestBed.createComponent(CompraComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});