import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';

import { RequestParam } from '../../../../../app/core/cache/models/request-param.model';
import { getFirstSucceededRemoteData, getRemoteDataPayload } from '../../../../../app/core/shared/operators';
import { ThemedLoadingComponent } from '../../../../../app/shared/loading/themed-loading.component';
import { VarDirective } from '../../../../../app/shared/utils/var.directive';
import { SiteStatisticsPageComponent as BaseComponent } from '../../../../../app/statistics-page/site-statistics-page/site-statistics-page.component';
import { StatisticsTableComponent } from '../../../../../app/statistics-page/statistics-table/statistics-table.component';
import { UsageReport } from '../../../../../app/core/statistics/models/usage-report.model';
import { dateToISOFormat } from '../../../../../app/shared/date.util';

@Component({
  standalone: true,
  selector: 'ds-themed-site-statistics-page',
  // styleUrls: ['./site-statistics-page.component.scss'],
  styleUrls: ['../../../../../app/statistics-page/site-statistics-page/site-statistics-page.component.scss'],
  templateUrl: '../statistics-page.component.html',
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    StatisticsTableComponent,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
  ],
})
export class SiteStatisticsPageComponent extends BaseComponent {
  startDate: string | null = null;
  endDate: string | null = null;
  startDateModel: NgbDateStruct | null = null;
  endDateModel: NgbDateStruct | null = null;

  private dateRange$ = new BehaviorSubject<{ startDate?: string | null; endDate?: string | null }>({});

  ngOnInit(): void {
    this.scope$ = this.getScope$();
    this.reports$ = this.getReports$();
    this.hasData$ = this.reports$.pipe(
      map((reports) => reports.some((report) => report.points.length > 0)),
    );
  }

  applyDateRange(): void {
    this.setDateRange(this.toIsoDate(this.startDateModel, false), this.toIsoDate(this.endDateModel, true));
  }

  clearDateRange(): void {
    this.startDateModel = null;
    this.endDateModel = null;
    this.applyDateRange();
  }

  protected getReports$(): Observable<UsageReport[]> {
    return combineLatest([this.scope$, this.dateRange$]).pipe(
      switchMap(([scope, dateRange]) =>
        this.usageReportService.searchBy('object', {
          searchParams: this.buildSearchParams(scope._links.self.href, dateRange.startDate, dateRange.endDate),
          currentPage: 0,
          elementsPerPage: 20,
        }, false, true).pipe(
          getFirstSucceededRemoteData(),
          getRemoteDataPayload(),
          map((list) => list.page),
        ),
      ),
      shareReplay(1),
    );
  }

  private setDateRange(startDate: string | null, endDate: string | null): void {
    this.startDate = startDate;
    this.endDate = endDate;
    this.dateRange$.next({ startDate, endDate });
  }

  private toIsoDate(date: NgbDateStruct | null, isEndOfDay: boolean): string | null {
    if (!date) {
      return null;
    }
    const dateObj = new Date(Date.UTC(date.year, date.month - 1, date.day, isEndOfDay ? 23 : 0, isEndOfDay ? 59 : 0, isEndOfDay ? 59 : 0));
    return dateToISOFormat(dateObj);
  }

  private buildSearchParams(uri: string, startDate?: string | null, endDate?: string | null): RequestParam[] {
    const params = [new RequestParam('uri', uri)];
    if (startDate) {
      params.push(new RequestParam('startDate', startDate));
    }
    if (endDate) {
      params.push(new RequestParam('endDate', endDate));
    }
    return params;
  }
}

