import { CommonModule } from '@angular/common';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  NgbDateStruct,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { HighchartsChartModule } from 'highcharts-angular';
import { Subscription } from 'rxjs';
import { DSONameService } from 'src/app/core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from 'src/app/core/data/dspace-object-data.service';
import { getFirstSucceededRemoteData } from 'src/app/core/shared/operators';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

import { HighchartsService } from '../highcharts-service';
import {
  isoToNgbDate,
  ngbDateToIso,
} from '../ngb-date.util';

interface LabelledCount {
  label: string;
  views: number;
}

interface DashboardResponse {
  id: string;
  label: string;
  scopeType: string;
  views: number;
  downloads: number;
  itemsViewed: number;
  topCountries: LabelledCount[];
  topCities: LabelledCount[];
}

interface SeriesPoint {
  date: string;
  views: number;
  downloads: number;
}

interface SeriesResponse {
  id: string;
  label: string;
  gap: string;
  points: SeriesPoint[];
}

/**
 * Usage overview for the whole repository, a community or a collection: headline totals, a
 * views-and-downloads graph over the reporting period, and where the traffic came from.
 *
 * Backed by /api/otcloud-stats/dashboard and /api/otcloud-stats/series. Because usage events carry
 * every ancestor community, a community dashboard automatically includes its sub-communities.
 */
@Component({
  selector: 'ds-usage-dashboard',
  imports: [CommonModule, NgbDatepickerModule, ReactiveFormsModule, TranslateModule, HighchartsChartModule],
  templateUrl: './usage-dashboard.component.html',
  styleUrl: './usage-dashboard.component.scss',
})
export class UsageDashboardComponent implements OnInit, OnDestroy {

  @Input() uuid?: string;
  @Input() object?: any;

  Highcharts: any;
  chartOptions: any;

  dashboard: DashboardResponse | null = null;
  resolvedUuid: string | null = null;
  resolvedObjectName = '';

  isLoading = false;
  errorMessage: string | null = null;
  validationError: string | null = null;

  /**
   * Default reporting window when the user has not chosen one: the last twelve months.
   */
  filterForm = new FormGroup({
    startDate: new FormControl<NgbDateStruct | null>(isoToNgbDate(this.defaultStart())),
    endDate: new FormControl<NgbDateStruct | null>(isoToNgbDate(this.today())),
    gap: new FormControl('month'),
  });

  private dashboardSub?: Subscription;
  private seriesSub?: Subscription;
  private routeSub?: Subscription;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private dsoService: DSpaceObjectDataService,
    private dsoNameService: DSONameService,
    private highchartsService: HighchartsService,
    private translateService: TranslateService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) { }

  private regionDisplayNames: any;
  private regionDisplayNamesLang: string | null = null;

  /**
   * Resolve an ISO 3166-1 alpha-2 country code (as returned by the stats API) to its localized
   * display name, e.g. "US" -> "United States". Falls back to the raw code when the runtime has
   * no Intl.DisplayNames support or the code isn't recognized.
   */
  countryName(code: string): string {
    if (!code) {
      return code;
    }
    const lang = this.translateService.currentLang || 'en';
    if (!this.regionDisplayNames || this.regionDisplayNamesLang !== lang) {
      const DisplayNamesCtor = (Intl as any).DisplayNames;
      if (!DisplayNamesCtor) {
        return code;
      }
      try {
        this.regionDisplayNames = new DisplayNamesCtor([lang], { type: 'region' });
        this.regionDisplayNamesLang = lang;
      } catch {
        return code;
      }
    }
    return this.regionDisplayNames.of(code.toUpperCase()) || code;
  }

  ngOnInit(): void {
    this.Highcharts = this.highchartsService.getHighcharts();

    this.routeSub = this.route.params.subscribe((params) => {
      this.resolvedUuid = params['uuid'] || this.uuid || this.object?.uuid || this.object?.id;
      if (!this.resolvedUuid) {
        this.errorMessage = 'No UUID provided for the usage dashboard.';
        this.cdr.detectChanges();
        return;
      }
      this.resolveName();
      this.load();
    });
  }

  private resolveName(): void {
    if (this.object) {
      this.resolvedObjectName = this.dsoNameService.getName(this.object);
      return;
    }
    this.dsoService.findById(this.resolvedUuid).pipe(
      getFirstSucceededRemoteData(),
    ).subscribe((rd) => {
      if (rd.hasSucceeded && rd.payload) {
        this.resolvedObjectName = this.dsoNameService.getName(rd.payload);
        this.cdr.detectChanges();
      }
    });
  }

  load(): void {
    if (!this.resolvedUuid) {
      return;
    }

    const start = ngbDateToIso(this.filterForm.value.startDate);
    const end = ngbDateToIso(this.filterForm.value.endDate);
    if (!start || !end) {
      this.validationError = 'Both a start and an end date are required.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.validationError = null;
    this.cdr.detectChanges();

    const params = new HttpParams()
      .set('uuid', this.resolvedUuid)
      .set('startDate', `${start}T00:00:00Z`)
      .set('endDate', `${end}T23:59:59Z`);

    this.dashboardSub?.unsubscribe();
    this.dashboardSub = this.http.get<DashboardResponse>(this.endpoint('dashboard'), { params }).subscribe({
      next: (response) => {
        this.dashboard = response;
        this.isLoading = false;
        this.cdr.detectChanges();
        this.scrollToFragment();
      },
      error: (err) => {
        console.error('Error fetching usage dashboard:', err);
        this.errorMessage = 'Failed to load the usage dashboard.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });

    const seriesParams = params.set('gap', this.filterForm.value.gap || 'month');
    this.seriesSub?.unsubscribe();
    this.seriesSub = this.http.get<SeriesResponse>(this.endpoint('series'), { params: seriesParams }).subscribe({
      next: (response) => {
        this.buildChart(response);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching usage series:', err);
        this.cdr.detectChanges();
      },
    });
  }

  private buildChart(series: SeriesResponse): void {
    const points = series?.points || [];
    this.chartOptions = {
      chart: { type: 'line' },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories: points.map((p) => this.formatDate(p.date, series.gap)),
        title: { text: null },
      },
      yAxis: {
        title: { text: null },
        allowDecimals: false,
        min: 0,
      },
      tooltip: { shared: true },
      series: [
        { name: 'Views', data: points.map((p) => p.views) },
        { name: 'Downloads', data: points.map((p) => p.downloads) },
      ],
    };
  }

  /**
   * Render an interval's ISO start instant as a label appropriate to the interval size.
   */
  private formatDate(iso: string, gap: string): string {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    if (isNaN(date.getTime())) {
      return iso;
    }
    if (gap === 'year') {
      return `${date.getUTCFullYear()}`;
    }
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    if (gap === 'month') {
      return `${date.getUTCFullYear()}-${month}`;
    }
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}-${day}`;
  }

  onSubmit(): void {
    this.load();
  }

  /**
   * Jump to the section named by the route fragment, e.g. when arriving from the "Top Countries"
   * quick link. Deferred a tick because the target card only exists once `dashboard` has rendered.
   */
  private scrollToFragment(): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) {
      return;
    }
    setTimeout(() => {
      document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private endpoint(path: string): string {
    const baseUrl = this.appConfig.rest.baseUrl;
    const separator = baseUrl.endsWith('/') ? '' : '/';
    return `${baseUrl}${separator}api/otcloud-stats/${path}`;
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private defaultStart(): string {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    return date.toISOString().split('T')[0];
  }

  ngOnDestroy(): void {
    this.dashboardSub?.unsubscribe();
    this.seriesSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }
}
