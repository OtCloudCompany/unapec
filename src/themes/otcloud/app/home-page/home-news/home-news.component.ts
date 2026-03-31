import { Component } from '@angular/core';

import { HomeNewsComponent as BaseComponent } from '../../../../../app/home-page/home-news/home-news.component';
import { TranslateModule } from '@ngx-translate/core';
import { ThemedSearchFormComponent } from 'src/app/shared/search-form/themed-search-form.component';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'ds-themed-home-news',
  styleUrls: ['../../../../../app/home-page/home-news/home-news.component.scss', './home-news.component.scss'],
  templateUrl: './home-news.component.html',
  imports: [
    TranslateModule,
    ThemedSearchFormComponent,
    NgbCarouselModule
  ]
})
export class HomeNewsComponent extends BaseComponent {
}
