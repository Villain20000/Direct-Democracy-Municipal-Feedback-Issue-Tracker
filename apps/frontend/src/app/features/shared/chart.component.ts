import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart, ChartConfiguration, ChartType, registerables,
} from 'chart.js';
import { TranslationService } from '../../core/i18n/translation.service';

export type ChartKind = 'line' | 'bar' | 'doughnut' | 'pie' | 'radar';

/**
 * Shared theme-aware chart wrapper (PLAN §10 — department comparison
 * bar, ward distribution pie, sentiment trend line, workload chart,
 * category donut, resolution-time trend).
 *
 * Usage:
 *   <app-chart
 *     kind="doughnut"
 *     [labels]="['Potholes', 'Graffiti']"
 *     [data]="[12, 5]"
 *     [height]="220" />
 *
 * The wrapper re-renders on any input change, destroys the previous
 * canvas instance (no leak), and colors labels/borders from the CSS
 * custom-property palette so charts match light + dark mode.
 */
@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #canvas [style.height.px]="height"></canvas>`,
  styles: [`:host { display: block; width: 100%; }`],
})
export class ChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() kind: ChartKind = 'bar';
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() datasetLabel = '';
  /** Optional second dataset (line charts with two series). */
  @Input() data2: number[] | null = null;
  @Input() datasetLabel2 = '';
  @Input() height = 220;
  /** Explicit colors; falls back to the built-in categorical palette. */
  @Input() colors: string[] | null = null;
  @Input() stacked = false;
  @Input() showLegend = true;

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;
  private i18n = inject(TranslationService);

  /** Chart.js elements are registered lazily on first render (once per
   *  page load) so the registration cost is paid only when a chart is
   *  actually displayed. Tree-shaking individual registerables is not
   *  supported by chart.js 4.x, so the full set is registered. */
  private static registered = false;
  private static ensureRegistered() {
    if (!ChartComponent.registered) {
      Chart.register(...registerables);
      ChartComponent.registered = true;
    }
  }

  private static readonly PALETTE = [
    '#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED',
    '#0D9488', '#EA580C', '#4F46E5', '#0284C7', '#D97706',
  ];

  ngAfterViewInit() {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges() {
    if (this.viewReady) this.render();
  }

  ngOnDestroy() {
    this.chart?.destroy();
    this.chart = null;
  }

  private render() {
    if (!this.canvas?.nativeElement) return;
    ChartComponent.ensureRegistered();
    this.chart?.destroy();

    const isPie = this.kind === 'doughnut' || this.kind === 'pie';
    const palette = this.colors && this.colors.length
      ? this.colors
      : ChartComponent.PALETTE;

    const datasets: ChartConfiguration<'line' | 'bar' | 'doughnut' | 'pie' | 'radar'>['data']['datasets'] = [
      {
        label: this.datasetLabel,
        data: this.data,
        ...(isPie
          ? {
              backgroundColor: this.data.map((_, i) => palette[i % palette.length]),
              borderColor: '#fff',
              borderWidth: 2,
            }
          : {
              backgroundColor: this.kind === 'line' ? 'rgba(37,99,235,0.12)' : palette[0],
              borderColor: palette[0],
              borderWidth: 2,
              tension: 0.3,
              fill: this.kind === 'line',
            }),
      },
    ];

    if (this.data2 && this.data2.length) {
      datasets.push({
        label: this.datasetLabel2,
        data: this.data2,
        backgroundColor: this.kind === 'line' ? 'rgba(22,163,74,0.12)' : palette[1],
        borderColor: palette[1],
        borderWidth: 2,
        tension: 0.3,
        fill: this.kind === 'line',
      });
    }

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#475569';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-light').trim() || 'rgba(148,163,184,0.25)';

    const config: ChartConfiguration = {
      type: this.kind as any,
      data: { labels: this.labels, datasets: datasets as any },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: this.showLegend,
            position: isPie ? ('right' as const) : ('bottom' as const),
            labels: { color: textColor, boxWidth: 14, font: { size: 11 } },
          },
          tooltip: { enabled: true },
        },
        scales: isPie
          ? {}
          : {
              x: {
                stacked: this.stacked,
                ticks: { color: textColor, font: { size: 11 }, maxRotation: 45 },
                grid: { color: gridColor },
              },
              y: {
                stacked: this.stacked,
                beginAtZero: true,
                ticks: { color: textColor, font: { size: 11 }, precision: 0 },
                grid: { color: gridColor },
              },
            },
      },
    };

    this.chart = new Chart(this.canvas.nativeElement, config);
  }
}
