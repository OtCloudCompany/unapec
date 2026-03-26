import { AsyncPipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { TopLevelCommunityListComponent as BaseComponent } from '../../../../../app/home-page/top-level-community-list/top-level-community-list.component';
import { ErrorComponent } from '../../../../../app/shared/error/error.component';
import { ThemedLoadingComponent } from '../../../../../app/shared/loading/themed-loading.component';
import { VarDirective } from '../../../../../app/shared/utils/var.directive';
import { RemoteData } from 'src/app/core/data/remote-data';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { CommunityDataService } from 'src/app/core/data/community-data.service';
import { PaginationService } from 'src/app/core/pagination/pagination.service';
import { PaginatedList } from 'src/app/core/data/paginated-list.model';
import { Community } from 'src/app/core/shared/community.model';
import { RouterLink } from '@angular/router';

interface FetchedCommunity {
  name: string;
  uuid: string;
  itemsCount: number;
  logo: string;
}

@Component({
  selector: 'ds-themed-top-level-community-list',
  // styleUrls: ['./top-level-community-list.component.scss'],
  styleUrls: ['../../../../../app/home-page/top-level-community-list/top-level-community-list.component.scss'],
  templateUrl: './top-level-community-list.component.html',
  imports: [
    AsyncPipe, RouterLink,
    ErrorComponent,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
  ],
})
export class TopLevelCommunityListComponent extends BaseComponent {
  communitiesFetched: FetchedCommunity[] = [];
  featuredCommunities: { [key: string]: string } = {
    '248cb0be-c119-4089-855a-5cb945fba838': 'fa-address-card',
    '1ec4fa24-4c0e-47ef-84d8-399f1dac1e69': 'fa-area-chart',
    'b8735929-6307-4a8b-8ca2-a1dd7abcfa72': 'fa-book',
    'cc59921e-c92a-40f7-b710-8591866d375d': 'fa-line-chart',
    '6ab0f98f-3695-4fac-a0bc-ab35d887b6e2': 'fa-university',
    '667ed4c7-087f-467f-b3f0-5ddcb218811c': 'fa-chart-area',
  };

  constructor(@Inject(APP_CONFIG) protected appConfig: AppConfig,
    communityDataService: CommunityDataService,
    paginationService: PaginationService) {
    super(appConfig, communityDataService, paginationService);
  }

  ngOnInit() {
    super.ngOnInit();

    this.communitiesRD$.subscribe((rsp: RemoteData<PaginatedList<Community>>) => {
      if (rsp.hasCompleted && rsp.payload) {

        // Step 1: Get only the communities that exist in featuredCommunities
        const filteredCommunities = rsp.payload.page.filter((community) => {
          return this.featuredCommunities.hasOwnProperty(community.uuid);
        });

        // Step 2: Convert the filtered communities into the desired format
        const mappedCommunities = filteredCommunities.map((community) => {
          return {
            name: community.name,
            uuid: community.uuid,
            logo: community.uuid,
            itemsCount: community.archivedItemsCount > 0 ? community.archivedItemsCount : 0,
          };
        });

        // Step 3: Sort the communities based on the order in featuredCommunities
        // Use a predefined order array for sorting based on the keys
        const order = [
          '248cb0be-c119-4089-855a-5cb945fba838',
          '1ec4fa24-4c0e-47ef-84d8-399f1dac1e69',
          'b8735929-6307-4a8b-8ca2-a1dd7abcfa72',
          'cc59921e-c92a-40f7-b710-8591866d375d',
          '6ab0f98f-3695-4fac-a0bc-ab35d887b6e2',
          '667ed4c7-087f-467f-b3f0-5ddcb218811c',
        ];

        const sortedCommunities = mappedCommunities.sort((a, b) => {
          return order.indexOf(a.uuid) - order.indexOf(b.uuid);
        });

        // Step 4: Assign the final sorted list to communitiesFetched
        this.communitiesFetched = sortedCommunities;
      }
    });
  }
}
