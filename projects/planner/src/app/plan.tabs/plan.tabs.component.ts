import { AfterViewInit, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { MdbTabChange, MdbTabsComponent } from 'mdb-angular-ui-kit/tabs/tabs.component';
import { DiveSchedule } from '../shared/dive.schedules';
import { ManagedDiveSchedules } from '../shared/managedDiveSchedules';
import { Streamed } from '../shared/streamed';
import { takeUntil } from 'rxjs';

@Component({
    selector: 'app-plan-tabs',
    templateUrl: './plan.tabs.component.html',
    styleUrls: ['./plan.tabs.component.scss']
})
export class PlanTabsComponent extends Streamed implements AfterViewInit {
    @ViewChild('tabs') public tabs: MdbTabsComponent | undefined;
    public addIcon = faPlus;

    constructor(public schedules: ManagedDiveSchedules, private cd: ChangeDetectorRef) {
        super();
    }

    // TODO add loading to the tab header
    // TODO Main menu overlaps the tabs, when text is wrapped on two rows (and some other responsiveness glitches)

    public ngAfterViewInit(): void {
        // hack to fix missing initial value of the selected tab
        const selectedIndex = this.schedules.selectedIndex;
        this.tabs?.setActiveTab(selectedIndex);
        this.cd.detectChanges();

        this.tabs?.activeTabChange.pipe(takeUntil(this.unsubscribe$))
            .subscribe((e: MdbTabChange) => {
                this.selectedChanged(e);
            });
    }

    public closeTab(dive: DiveSchedule): void {
        this.schedules.remove(dive);
    }

    public addTab(): void {
        this.schedules.add();
    }

    private selectedChanged(e: MdbTabChange): void {
        let newIndex = e.index;
        if (e.index === this.schedules.length) {
            newIndex = e.index - 1;
            this.tabs?.setActiveTab(newIndex);
        }

        this.schedules.select(newIndex);
    }
}
