import {Observable, Subject} from 'rxjs';
import {Tank} from 'scuba-physics';
import {Injectable} from '@angular/core';

/**
 * Since we show only the selected dive schedule, we are always reloading properties of selected dive.
 */
@Injectable()
export class ReloadDispatcher {
    /**
     *  Event fired only in case of tanks rebuild (loadFrom or resetToSimple).
     *  Not fired when adding or removing tanks.
     **/
    public tanksReloaded$: Observable<void>;
    public tankRemoved$: Observable<Tank>;
    // TODO rebind depths reloaded
    /** Event fired only in case of segments rebuild. Not fired when adding or removing. */
    public depthsReloaded$: Observable<void>;
    public depthChanged$: Observable<void>;

    public optionsReloaded$: Observable<void>;

    // TODO how to prevent fire the event multiple times, in case of reloadAll? we filter,
    //      in case the reload isn't done for selected diveSchedule
    public selectedChanged$: Observable<void>;

    private onTanksReloaded = new Subject<void>();
    private onTankRemoved = new Subject<Tank>();
    private onDepthsReloaded = new Subject<void>();
    private onDepthChanged = new Subject<void>();
    private onOptionsReloaded = new Subject<void>();
    private onSelectedChanged = new Subject<void>();

    constructor() {
        this.tanksReloaded$ = this.onTanksReloaded.asObservable();
        this.tankRemoved$ = this.onTankRemoved.asObservable();
        this.depthsReloaded$ = this.onDepthsReloaded.asObservable();
        this.depthChanged$ = this.onDepthChanged.asObservable();
        this.optionsReloaded$ = this.onOptionsReloaded.asObservable();
        this.selectedChanged$ = this.onSelectedChanged.asObservable();
    }

    public sendTanksReloaded(): void {
        this.onTanksReloaded.next();
    }

    public sendTanksRemoved(removed: Tank): void {
        this.onTankRemoved.next(removed);
    }
    public sendDepthsReloaded(): void {
        this.onDepthsReloaded.next();
    }

    public sendDepthChanged(): void {
        this.onDepthChanged.next();
    }

    public sendOptionsReloaded(): void {
        this.onOptionsReloaded.next();
    }

    public sendSelectedChanged(): void {
        this.onSelectedChanged.next();
    }
}
