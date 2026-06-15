import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import { UsageReport } from '../../core/statistics/models/usage-report.model';

/**
 * Component representing a statistics table for a given usage report.
 */
@Component({
  selector: 'ds-statistics-table',
  templateUrl: './statistics-table.component.html',
  styleUrls: ['./statistics-table.component.scss'],
  imports: [
    TranslateModule,
  ],
})
export class StatisticsTableComponent implements OnInit, OnChanges {

  /**
   * The usage report to display a statistics table for
   */
  @Input()
  report: UsageReport;

  /**
   * Boolean indicating whether the usage report has data
   */
  hasData: boolean;

  /**
   * The table headers
   */
  headers: string[];

  constructor(
    protected dsoService: DSpaceObjectDataService,
    protected nameService: DSONameService,
  ) {

  }

  ngOnInit() {
    this.updateReportData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.report && this.report) {
      this.updateReportData();
    }
  }

  private updateReportData(): void {
    this.hasData = this.report?.points?.length > 0;
    if (this.hasData) {
      this.headers = Object.keys(this.report.points[0].values);
    } else {
      this.headers = [];
    }
  }
}
