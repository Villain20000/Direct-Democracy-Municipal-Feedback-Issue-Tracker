import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartComponent } from './chart.component';

describe('ChartComponent (P1-8 shared Chart.js wrapper)', () => {
  let fixture: ComponentFixture<ChartComponent>;
  let component: ChartComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ChartComponent);
    component = fixture.componentInstance;
  });

  it('creates with bar-chart defaults', () => {
    expect(component).toBeTruthy();
    expect(component.kind).toBe('bar');
    expect(component.height).toBe(220);
    expect(component.showLegend).toBeTrue();
    expect(component.stacked).toBeFalse();
  });

  it('lazily registers Chart.js on first render', () => {
    component.labels = ['Potholes', 'Graffiti'];
    component.data = [12, 5];
    fixture.detectChanges();
    expect((ChartComponent as unknown as { registered: boolean }).registered).toBeTrue();
    expect((component as unknown as { chart: unknown }).chart).not.toBeNull();
  });

  it('renders a two-series line chart (reported vs resolved)', () => {
    component.kind = 'line';
    component.labels = ['W1', 'W2'];
    component.data = [4, 6];
    component.data2 = [1, 2];
    component.datasetLabel = 'Reported';
    component.datasetLabel2 = 'Resolved';
    fixture.detectChanges();
    const chart = (component as unknown as { chart: {
      data: { labels: unknown; datasets: unknown[] };
    } | null }).chart;
    expect(chart).not.toBeNull();
    expect(chart?.data.labels).toEqual(['W1', 'W2']);
    expect(chart?.data.datasets.length).toBe(2);
  });

  it('renders a doughnut with one color per slice', () => {
    component.kind = 'doughnut';
    component.labels = ['A', 'B', 'C'];
    component.data = [3, 2, 1];
    fixture.detectChanges();
    const chart = (component as unknown as { chart: {
      data: { datasets: Array<{ backgroundColor: unknown[] }> };
    } | null }).chart;
    expect(chart).not.toBeNull();
    expect(chart?.data.datasets[0].backgroundColor.length).toBe(3);
  });

  it('destroys the chart instance on destroy (no leak)', () => {
    component.labels = ['A'];
    component.data = [1];
    fixture.detectChanges();
    fixture.destroy();
    expect((component as unknown as { chart: unknown }).chart).toBeNull();
  });
});
